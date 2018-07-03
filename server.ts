import * as express from 'express';
import * as config from './config';
var app = express();
import { urlencoded, json } from 'body-parser';
import { connect } from 'mongoose';
import { userRouter } from './src/routes/user.route';
import { testsRouter } from './src/routes/tests.route';

const PORT: number = 3000;

connect(`mongodb://factfluency:${config.mongodbPassword}@factfluency-shard-00-00-vywlr.mongodb.net:27017,factfluency-shard-00-01-vywlr.mongodb.net:27017,factfluency-shard-00-02-vywlr.mongodb.net:27017/test?ssl=true&replicaSet=FactFluency-shard-0&authSource=admin&retryWrites=true`);

app.use(urlencoded({ extended: false }));
app.use(json());
app.use('/user', userRouter);
app.use('/tests', testsRouter)

app.listen(PORT, (): void => {
  console.log('Server is running on port', PORT);
});
