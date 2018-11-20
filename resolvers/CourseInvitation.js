import {
  assertTeacherIsAuthorizedToRemoveCourseInvitation,
  assertStudentIsAuthorizedToRemoveCourseInvitation,
  assertCourseDoesNotContainInvitation,
  assertDocumentExists,
} from '../authorization';

import { assertAuthenticatedUserIsAuthorizedToUpdateCourse } from '../authorization/Course';
import { AuthenticationError } from 'apollo-server-core';

const resolvers = {
  CourseInvitation: {
    id(courseInvitation) {
      return courseInvitation._id;
    },

    student(courseInvitation, args, { CourseInvitation }) {
      return CourseInvitation.student(courseInvitation);
    },

    course(courseInvitation, args, { CourseInvitation }) {
      return CourseInvitation.course(courseInvitation);
    }
  },
  Query: {
    courseInvitations(root, { lastCreatedAt, limit }, { CourseInvitation }) {
      return CourseInvitation.all({ lastCreatedAt, limit });
    },

    courseInvitation(root, { id }, { CourseInvitation }) {
      return CourseInvitation.findOneById(id);
    },
  },
  Mutation: {
    async createCourseInvitation(root, { input }, { authedUser, Course, CourseInvitation, Student, Teacher, User }) {
      const { courseId, email } = input
      const { _id: teacherId } = await Teacher.findOneByUserId(authedUser.userId);
      const course = await Course.findOneById(courseId);
      await assertAuthenticatedUserIsAuthorizedToUpdateCourse(teacherId, course);
      const { _id: userId } = await User.findOneByEmail(email)
      const { _id: studentId } = await Student.findOneByUserId(userId);
      await assertCourseDoesNotContainInvitation(courseId, studentId, CourseInvitation);
      const courseInvitationId = await CourseInvitation.insert({ courseId, studentId });
      return await CourseInvitation.findOneById(courseInvitationId);
    },

    async removeCourseInvitation(root, { id: courseInvitationId }, { authedUser, CourseInvitation, Teacher, Student, Course }) {
      const courseInvitation = await CourseInvitation.findOneById(courseInvitationId);
      await assertDocumentExists(courseInvitation, 'CourseInvitation');
      if (authedUser.role === 'teacher') {
        const { _id: teacherId} = await Teacher.findOneByUserId(authedUser.userId);
        await assertTeacherIsAuthorizedToRemoveCourseInvitation(teacherId, courseInvitation.courseId, Course);
      } else if (authedUser.role === 'student') {
        const { _id: studentId} = await Student.findOneByUserId(authedUser.userId);
        await assertStudentIsAuthorizedToRemoveCourseInvitation(studentId, courseInvitation);
      } else {
        throw new AuthenticationError('You are not authorized to remove this course invitation')
      }
      return CourseInvitation.removeById(courseInvitationId);
    }
  },
};

export default resolvers;
