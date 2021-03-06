import { ObjectId } from 'mongodb';
import { UserInputError } from 'apollo-server-core';

import {
  assertUserWithEmailDoesNotExist,
  assertUserWithUsernameDoesNotExist,
} from '../authorization/User';
import {
  assertAuthenticatedUserIsAuthorizedToGetStudent,
  assertAuthenticatedUserIsAuthorizedToGetStudents,
  assertAuthenticatedUserIsAuthorizedToUpdateStudent,
  assertAuthenticatedUserIsAuthorizedToRemoveStudent,
  assertAuthenticatedUserIsAuthorizedToRemovePendingStudent,
  assertAuthenticatedUserIsAuthorizedToGetTestForStudent,
  assertChangePasswordIsRequired,
} from '../authorization/Student';

import { assertAuthenticatedUserIsAuthorizedToUpdateCourse } from '../authorization/Course';

import { createUniqueUsernameForNewStudent } from '../src/library/User';

const resolvers = {
  Student: {
    id(student) {
      return student._id;
    },

    courses(student, { lastCreatedAt, limit }, { Student }) {
      return Student.courses(student, { lastCreatedAt, limit });
    },

    tests(student, { courseId, lastCreatedAt, limit }, { Student }) {
      return Student.tests(student, { courseId, lastCreatedAt, limit });
    },

    async test(student, { testId }, { authedUser, Test, Student }) {
      if (testId === undefined || testId === null) {
        return null;
      }
      const test = await Test.findOneById(testId);
      await assertAuthenticatedUserIsAuthorizedToGetTestForStudent(authedUser, test, student);
      return test;
    },

    user(student, args, { Student }) {
      return Student.user(student);
    },

    parent(student, args, { Student }) {
      return Student.parent(student);
    },

    courseInvitations(student, { lastCreatedAt, limit }, { Student }) {
      return Student.courseInvitations(student, { lastCreatedAt, limit })
    },

    courseRequests(student, { lastCreatedAt, limit }, { Student }) {
      return Student.courseRequests(student, { lastCreatedAt, limit })
    }
  },
  Query: {
    async students(root, { lastCreatedAt, limit }, { authedUser, Student }) {
      const students = await Student.all({ lastCreatedAt, limit });
      await assertAuthenticatedUserIsAuthorizedToGetStudents(authedUser, students);
      return students
    },

    async student(root, { id }, { authedUser, Student, Teacher }) {
      if (id === undefined) {
        return Student.findOneByUserId(authedUser.userId)
      }
      const student = await Student.findOneById(id);
      await assertAuthenticatedUserIsAuthorizedToGetStudent(authedUser, student, Student, Teacher);
      return student;
    },
  },
  Mutation: {
    async createStudent(root, { input }, { Student, User }) {
      const { user: userInput, ...studentInput } = input;
      if (!userInput.email && !userInput.username) {
        throw new UserInputError('Username or Email is required');
      }
      if (userInput.username !== undefined && userInput.username !== null) {
        await assertUserWithUsernameDoesNotExist(userInput.username, User);
      } else {
        await assertUserWithEmailDoesNotExist(userInput.email, User);
      }
      const userId = await User.insert({
        ...userInput,
        role: 'student',
      });
      const studentId = await Student.insert({
        userId,
        ...studentInput,
        name: studentInput.name || userInput.email,
      });
      return Student.findOneById(studentId);
    },

    async updateStudent(root, { id: studentId, input }, { authedUser, Student, User }) {
      const userId = await assertAuthenticatedUserIsAuthorizedToUpdateStudent(authedUser, studentId, Student)
      const { user: userInput, ...studentInput } = input;
      const user = await User.findOneById(userId);
      if (userInput.email !== user.email) {
        await assertUserWithEmailDoesNotExist(userInput.email, User);
      }
      if (userInput.username !== user.username) {
        await assertUserWithUsernameDoesNotExist(userInput.username, User);
      }
      await User.updateById(userId, userInput);
      await Student.updateById(studentId, studentInput);
      return Student.findOneById(studentId);
    },

    async updateNewStudent(root, { input }, { Student, User }) {
      const { email, username, password } = input.user;
      const { _id: userId } = await User.findOneByEmailOrUsername(email, username);
      const { _id: studentId, changePasswordRequired } = await Student.findOneByUserId(userId);
      await assertChangePasswordIsRequired(changePasswordRequired);
      await User.updateById(userId, { password, email });
      await Student.updateById(studentId, { changePasswordRequired: false });
      return Student.findOneById(studentId);
    },

    async removeStudent(root, { id: studentId }, { authedUser, Student, User, Test, Question, CourseInvitation, CourseRequest }) {
      if (studentId === undefined) {
        const student = await Student.findOneByUserId(authedUser.userId);
        studentId = student._id
      }
      await assertAuthenticatedUserIsAuthorizedToRemoveStudent(authedUser, studentId, Student)
      const student = await Student.findOneById(studentId)
      const tests = await Student.tests(student, { limit: 0 });
      await Promise.all(tests.map(async ({ _id }) => {
        await Question.removeByTestId(_id);
        await Test.removeById(_id);
      }));
      await CourseInvitation.removeByStudentId(studentId);
      await CourseRequest.removeByStudentId(studentId);
      const studentRemoved = await Student.removeById(studentId);
      const userRemoved = await User.removeById(student.userId);
      return userRemoved && studentRemoved;
    },

    async removePendingStudent(root, { studentId, courseId }, { authedUser, Student, Teacher, Course, User }) {
      const userId = await assertAuthenticatedUserIsAuthorizedToRemovePendingStudent(authedUser, studentId, courseId, Student, Teacher, Course)
      const userRemoved = await User.removeById(userId);
      const studentRemoved = await Student.removeById(studentId);
      return userRemoved && studentRemoved;
    },

    async createAccountForStudent(root, { input }, context) {
      const { authedUser, Teacher, Course, User } = context
      const { name, courseId, user } = input;
      const teacher = await Teacher.findOneByUserId(authedUser.userId);
      const { email: teacherEmail } = await Teacher.user(teacher);
      const course = await Course.findOneById(ObjectId(courseId));
      await assertAuthenticatedUserIsAuthorizedToUpdateCourse(teacher._id, course);
      const username = await createUniqueUsernameForNewStudent(user.firstName, user.lastName, course.name, User);
      return resolvers.Mutation.createStudent(root, {
        input: {
          name,
          coursesIds: [ObjectId(courseId)],
          user: {
            email: teacherEmail,
            username,
            ...user,
          },
          changePasswordRequired: true,
        }
      }, context);
    },

    async removeStudentFromCourse(root, { studentId, courseId }, { authedUser, Course, Student, Teacher }) {
      const { _id: teacherId } = await Teacher.findOneByUserId(authedUser.userId);
      const course = await Course.findOneById(ObjectId(courseId));
      await assertAuthenticatedUserIsAuthorizedToUpdateCourse(teacherId, course); 
      const { coursesIds } = await Student.findOneById(studentId);
      await Student.updateById(studentId, {
        coursesIds: coursesIds
          ? coursesIds.filter((id) => !id.equals(courseId))
          : []
      });
      return true;
    }
  },
};

export default resolvers;
