import { Document, Schema, Model, SchemaTypes, model } from 'mongoose'
import { ISchool } from '../library/schools/schools'

export interface ISchoolModel extends ISchool, Document { }
const SchoolSchema: Schema = new Schema({
  name: { 
    type: String,
    required: true,
    trim: true,
    maxLength: 50
   },
  teacherIDs: [SchemaTypes.ObjectId]
})

export const School: Model<ISchoolModel> = model<ISchoolModel>("School", SchoolSchema)