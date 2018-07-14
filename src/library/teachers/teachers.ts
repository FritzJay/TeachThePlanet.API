import { ITestParameters } from '../testParameters/testParameters';
import { Callback } from '../common';
import { Teacher, ITeacherModel } from '../../models/teacher.model';
import { addTeacherToSchool } from '../schools/schools';
import { ISchoolModel } from '../../models/school.model';

export interface ITeacher {
  user: string,
  displayName: string,
  testParameters?: ITestParameters,
  classIDs: string[],
}

export const createTeacher = (teacherParams: ITeacher, schoolName: string, callback: Callback): void => {
  const newTeacher = new Teacher({
    user: teacherParams.user,
    displayName: teacherParams.displayName,
    testParameters: teacherParams.testParameters,
    classIDs: teacherParams.classIDs,
  });
  newTeacher.save((error: Error, teacher: ITeacherModel) => {
    if (error) {
      throw error;
    }
    try {
      addTeacherToSchool(teacher, schoolName, (_school: ISchoolModel) =>{
        callback(teacher);
      });
    } catch (error) {
      teacher.remove();
      throw error;
    }
  });
}

export const getTeacherByID = (teacherID: string, callback: Callback): void => {
  Teacher.findById(teacherID)
  .exec()
  .then((teacher: ITeacherModel) => {
    if (!teacher) {
      throw 'Unable to find teacher';
    }
    callback(teacher);
  });
}

export const getTeacherByUserID = (userID: string, callback: Callback): void => {
  Teacher.findOne({ user: userID })
  .exec()
  .then((teacher: ITeacherModel) => {
    if (!teacher) {
      throw 'Unable to find teacher';
    }
    callback(teacher);
  });
}

export const addClassToTeacher = (classID: string, userID: string, callback: Callback): void => {
  getTeacherByUserID(userID, (teacher: ITeacherModel) => {
    teacher.classIDs.push(classID);
    teacher.save((error: Error, teacher: ITeacherModel) => {
      if (error) {
        throw error;
      }
      callback(teacher);
    });
  });
}