import { AuthenticationError } from 'apollo-server-express'
import { ExtractJwt } from 'passport-jwt';
import jwt from 'jwt-simple';
import bcrypt from 'bcrypt';
import bodyParser from 'body-parser';
import addModelsToContext from '../model';

const KEY = '~key~';
const unAuthenticatedRoutes = [
  'IntrospectionQuery',
  'createUser',
  'createTeacher',
  'createStudent',
]

export function getUserIDFromAuthHeader(req) {
  if (unAuthenticatedRoutes.includes(req.body.operationName)) {
    return undefined
  }

  const token = ExtractJwt.fromAuthHeaderWithScheme('jwt')(req)
  try {
    return jwt.decode(token, KEY)
  } catch (error) {
    throw new AuthenticationError('Authentication is required')
  }
}

export default function addPassport(app, db) {
  app.use('/login', bodyParser.urlencoded({ extended: true }));
  app.use('/login', bodyParser.json())
  app.use('/login', (req, res, next) => {
    req.context = addModelsToContext({ db });
    next();
  });

  app.post('/login', async ({ body, context }, res, next) => {
    const { email, password, role } = body;

    if (!email || !password || !role) {
      res.json({ error: 'Username password or role not set on request' });
      return next();
    }
    
    const user = await context.User.collection.findOne({ email, role });
    if (!user || !(await bcrypt.compare(password, user.hash))) {
      res.json({ error: 'User not found matching email/password combination' });
      return next();
    }

    const payload = {
      userId: user._id.toString(),
      role: user.role.toString(),
    };

    const token = jwt.encode(payload, KEY);
    res.json({ token });
  });
}