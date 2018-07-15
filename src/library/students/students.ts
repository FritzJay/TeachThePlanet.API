import { ITest } from '../tests/tests';
import { Student, IStudentModel } from '../../models/student.model';
import { IClassModel } from '../../models/class.model';
import { Callback } from '../common';
import { addStudentToClass, IClass, getClassByClassCode } from '../classes/classes';
import { Types } from 'mongoose';

export interface IStudent {
  userID: Types.ObjectId,
  displayName: string,
  tests?: ITest[],
}

export const createStudent = (studentParams: IStudent, classCode: string, callback: Callback): void => {
  const newStudent = new Student({
    userID: studentParams.userID,
    displayName: studentParams.displayName,
    tests: studentParams.tests,
  });
  newStudent.save((error: Error, student: IStudentModel) => {
    if (error) {
      throw error;
    }
    try {
      addStudentToClass(student._id, classCode, (cls: IClassModel) => {
        callback(cls);
      });
    } catch (error) {
      student.remove();
      throw error;
    }
  });
}

export const getStudentByDisplayNameAndClassCode = (displayName: string, classCode: string, callback: Callback): void => {
  getClassByClassCode(classCode, (cls: IClassModel) => {
    Student.findOne({
      displayName: displayName,
      userID: { $in: cls.studentIDs }
    })
    .exec()
    .then((student: IStudentModel) => {
      callback(student);
    });
  });
}
