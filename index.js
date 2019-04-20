'use strict'

const fastify = require("./fastify")
const routes = require("./routes")
const task = require('child_process');
const registers = require('./resolvers')
//const daemon = task.fork('./daemon');

fastify.register(
  routes, {
    prefix: '/api/v1'
  }
)

registers.api.initWeb3()
// Run the server!
const start = async () => {
  try {
    const port = process.env.PORT ? process.env.PORT : 3000
    await fastify.listen(port, '0.0.0.0')
    fastify.swagger()
    fastify.log.info(`server listening on ${fastify.server.address().port}`)
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
}
start()