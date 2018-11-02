import { ArgumentError } from "../common"
import { ITestParameters } from "../testParameters/testParameters"
import { Test, ITestModel } from "../../models/test.model"
import * as mathjs from "mathjs"
import { Types } from "mongoose"
import { TestParameters } from "../../models/testParameters.model"

export const OPERATORS: string[] = ['+', '-', '*', '/']
export const NUMBERS: ITestNumber[] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => {
  return {
    number: n,
    operators: OPERATORS
  }
})
export const MAX_NUMBER = 12
export const PASSING_PERCENTAGE = 0.9

export interface ITestNumber {
  number: number
  operators: string[]
}

export interface IAvailableTests {
  numbers: ITestNumber[]
}

export interface ITest {
  userID?: Types.ObjectId
  duration?: number
  start?: Date
  end?: Date
  questions: IQuestion[]
}

export interface IQuestion {
  question: string
  studentAnswer?: number
  correctAnswer?: number
  start?: Date
  end?: Date
}

export interface ITestResults {
  total: number
  needed: number
  correct: number
  incorrect: IQuestion
  quickest: IQuestion
}

export const getAvailableTests = async (userID: string): Promise<IAvailableTests> => {
  console.log('Getting available tests for userID')
  console.log(`userID: ${userID}`)

  // Temporarily return all tests
  return {
    numbers: NUMBERS
  }
}

export const newTest = async (params: ITestParameters, userID: string): Promise<ITest> => {
  console.log('Creating a new test')
  console.log(`userID: ${userID}`)
  console.log(TestParameters)

  await assertNewTestArgumentsAreValid(params)

  const { duration, number, operator, questions, randomQuestions } = params

  await assertUserIsAuthorizedForNewTest(userID, number, operator)

  const newQuestions: IQuestion[] = createQuestions(operator, number, questions, randomQuestions)
  
  return {
    duration,
    start: null,
    end: null,
    questions: newQuestions,
  }
}

export const gradeTest = async (test: ITest): Promise<ITestResults> => {
  console.log('Grading test')
  console.log(test)

  const total = test.questions.length
  const needed = Math.round(test.questions.length * PASSING_PERCENTAGE)
  const correct: number = setCorrectAnswers(test)
  const incorrect: IQuestion = getRandomIncorrectlyAnsweredQuestion(test)
  const quickest: IQuestion = getQuickestAnsweredQuestion(test)
  
  return {
    total,
    needed,
    correct,
    incorrect,
    quickest,
  }
}

export const submitTest = async (test: ITest): Promise<ITestModel> => {
  console.log('Submitting test')
  console.log(test)

  const {userID, duration, start, end, questions } = test

  if (test.userID) {
    return await new Test({ userID, duration, start, end, questions, }).save()
  } else {
    console.log('Unable to save test to database because there was no user assigned')
    throw new Error('Unable to save test to database because there was no user assigned')
  }
}

export const assertUserIsAuthorizedForNewTest = async (userID: string, number: number, operator: string) => {
  const availableTests = await getAvailableTests(userID)

  const matchingTestNumber = availableTests.numbers.find((testNumber: ITestNumber) => testNumber.number == number)
  if (!matchingTestNumber) {
    console.log(`Student is not authorized to test the number '${number}`)
    throw new Error(`Student is not authorized to test the number '${number}`)
  }

  const operatorIsAvailable = matchingTestNumber.operators.includes(operator)
  if (!operatorIsAvailable) {
    console.log(`Student is not authorized to test the operator '${operator}' for the number ${number}`)
    throw new Error(`Student is not authorized to test the operator '${operator}' for the number ${number}`)
  }
}

export const assertNewTestArgumentsAreValid = async (params: ITestParameters) => {
  let errors: ArgumentError[] = []

  if (!OPERATORS.includes(params.operator)) {
    errors.push(new ArgumentError('operator', params.operator, `Must be one of ${OPERATORS}.`))
  }
  if (params.number < 0 || params.number > 20) {
    errors.push(new ArgumentError('number', params.number, 'Must be in range 0-20'))
  }
  if (params.questions < 1) {
    errors.push(new ArgumentError('questions', params.questions, 'Must be greater than 1'))
  }
  if (params.randomQuestions < 0) {
    errors.push(new ArgumentError('randomQuestions', params.randomQuestions, 'Must be greater than 0'))
  }
  if (params.duration < 0) {
    errors.push(new ArgumentError('duration', params.duration, 'Must be greater than 0'))
  }

  if (errors.length > 0) {
    console.log(errors)
    throw errors
  }
}

export const createQuestions = (operator: string, number: number, questions: number, randomQuestions: number): IQuestion[] => {
  let formattedQuestions: IQuestion[] = []

  while (formattedQuestions.length < questions) {
    const secondNumber = formattedQuestions.length % MAX_NUMBER
    const formattedQuestion = createFormattedQuestion(operator, number, secondNumber)
    formattedQuestions.push(formattedQuestion)
  }

  while (formattedQuestions.length < questions + randomQuestions) {
    const randomNumberBetweenZeroAndNumber = (Math.random() * (number + 1) | 0)
    const randomNumberBetweenZeroAndMax = (Math.random() * (MAX_NUMBER + 1) | 0)
    formattedQuestions.push(createFormattedQuestion(operator, randomNumberBetweenZeroAndNumber, randomNumberBetweenZeroAndMax))
  }

  return formattedQuestions
}

export const setCorrectAnswers = (test: ITest): number => {
  let numberOfCorrectAnswers = 0

  for (let question of test.questions) {
    question.correctAnswer = mathjs.eval(question.question)
    
    if (isCorrect(question)) {
      numberOfCorrectAnswers++ 
    }
  }

  return numberOfCorrectAnswers
}

export const getRandomIncorrectlyAnsweredQuestion = (test: ITest): IQuestion => {
  const incorrectlyAnsweredQuestions: IQuestion[] = test.questions.filter((q) => !isCorrect(q))

  if (incorrectlyAnsweredQuestions.length > 0) {
    const answeredQuestions: IQuestion[] = incorrectlyAnsweredQuestions.filter((q) => !isSkipped(q))

    if (answeredQuestions.length > 0) {
      return answeredQuestions[Math.floor(Math.random() * answeredQuestions.length)]
    } else {
      return incorrectlyAnsweredQuestions[Math.floor(Math.random() * incorrectlyAnsweredQuestions.length)]
    }
  } else {
    return undefined
  }
}

export const getQuickestAnsweredQuestion = (test: ITest): IQuestion => {
  const correctlyAnsweredQuestions = test.questions.filter((q) => isCorrect(q))

  if (correctlyAnsweredQuestions.length !== 0) {
    return correctlyAnsweredQuestions.reduce((a, b) => {
      const aDuration: number = a.end.getTime() - a.start.getTime()
      const bDuration: number = b.end.getTime() - b.start.getTime()

      return aDuration < bDuration ? a : b
    })
  }
}

const isCorrect = (question: IQuestion): Boolean => {
  if (isSkipped(question)) {
    return false
  }

  return question.correctAnswer.toString() === question.studentAnswer.toString()
}

const isSkipped = (question: IQuestion): Boolean => {
  return question.studentAnswer === undefined || question.studentAnswer === null
}

export const createFormattedQuestion = (operator: string, firstNumber: number, secondNumber: number): IQuestion => {
  const numbers = [firstNumber, secondNumber]

  if (operator === '/') {
    numbers[1] = secondNumber * firstNumber
  }

  const shufflingWontResultInFractionsOrNegatives = !['-', '/'].includes(operator)
  if (shufflingWontResultInFractionsOrNegatives) {
    numbers.sort(() => Math.random() - 0.5)
  } else {
    numbers.sort((a: number, b: number) => b - a)
  }
  
  return {
    question: `${numbers[0]} ${operator} ${numbers[1]}`,
  }
}

export const incrementOrResetAt = (number: number, max: number): number => {
  if (number < max) {
    return number + 1
  } else {
    return 0
  }
}
