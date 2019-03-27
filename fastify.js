'use strict';

const fastify = require('fastify')({
    logger: {
        prettyPrint: true,
        serializers: {
            res(res) {
                // the default
                return {
                    statusCode: res.statusCode
                }
            },
            req(req) {
                return {
                    method: req.method,
                    url: req.url,
                    path: req.path,
                    parameters: req.parameters,
                    body: req.body,
                    //headers: req.headers
                };
            }
        }
    }
})

const cors = require('fastify-cors')

fastify.register(cors, { optionsSuccessStatus: 200 })


const fastifySwagger = require('fastify-swagger')
// Register Swagger
fastify.register(fastifySwagger, {
    mode: 'static',
    specification: {
        path: './docs/specification.yaml'
    },
    exposeRoute: true
})
// Declare a route
fastify.get('/', async (request, reply) => {
    return {
        hello: 'world'
    }
})

module.exports = fastify