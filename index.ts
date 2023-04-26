// Add express
import express, { NextFunction, Request, Response } from 'express'
const app = express()

// Add bcrypt
import * as bcrypt from 'bcrypt'

// Add prisma
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

// Parse application/json
app.use(express.json())

// Add dotnev
import * as dotenv from 'dotenv'
dotenv.config()

// Add Swagger
import swaggerUi from 'swagger-ui-express'
import yamljs from 'yamljs'
const swaggerDocument = yamljs.load('./swagger.yaml')
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument))

// Serve static files
app.use(express.static('public'))

// Set port
const port = process.env.Port || 3000

app.post('/users', async (req, res) => {

  // Validate email and password
  if (!req.body.email || !req.body.password) {
    return res.status(400).send('Email and password required')
  }

  // Validate that email is unique
  const userExists = await prisma.user.findUnique({
    where: {
      email: req.body.email
    }
  })

  if (userExists) {
    return res.status(409).send('Email already exists')
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(req.body.password, 10)

  // Create user
  await prisma.user.create({
    data: {
      email: req.body.email,
      password: hashedPassword,
    }
  })

  // Return user
  res.status(201).end()
})

app.post('/sessions', async (req, res) => {

  // Validate email and password
  if (!req.body.email || !req.body.password) {
    return res.status(400).send('Email and password required')
  }

  // Validate that email exists
  const user = await prisma.user.findUnique({
    where: {
      email: req.body.email
    }
  })

  if (!user) {
    return res.status(401).send('Invalid email or password')
  }

  // Validate password
  const validPassword = await bcrypt.compare(req.body.password, user.password)

  if (!validPassword) {
    return res.status(401).send('Invalid email or password')
  }

  // Create session
  const session = await prisma.session.create({
    data: {
      userId: user.id,
      expires: new Date(),
    }
  });

  // Return session
  res.status(201).json({
    sessionToken: session.sessionToken
  })
})

  // Add authorization middleware
  const authorizeRequest = async (req: Request, res: Response, next: NextFunction) => {

  // Validate session
  if (!req.headers.authorization) {
    return res.status(401).send('Authorization header required')
  }

  // Validate extract session format
  if (!req.headers.authorization.startsWith('Bearer') || req.headers.authorization.split(' ').length !== 2) {
    return res.status(401).send('Invalid authorization header format')
  }

  // Extract sessionToken
  const sessionToken = req.headers.authorization.split(' ')[1]

  const session = await prisma.session.findUnique({
    where: {
      sessionToken: sessionToken
    }
  })

  if (!session) {
    return res.status(401).send('Invalid session token')
  }

  // Add user to request
  let user = await prisma.user.findUnique({
    where: {
      id: session.userId
    }
  })

  // Validate user
  if (!user) {
    return res.status(401).send('Invalid session token')
  }

  // Add session to request
  // @ts-ignore
    req.sessionToken = sessionToken

  next()
}

app.delete('/sessions', authorizeRequest, async (req, res) => {

  // Delete session
  await prisma.session.delete({
    where: {
      sessionToken: req.sessionToken
    }
  })

  // Return session
  res.status(204).end()
})

// Listen to port
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}. Documentation at http://localhost:${port}/docs`)
})