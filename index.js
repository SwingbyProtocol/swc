'use strict'

const fastify = require("./fastify")
const routes = require("./routes")
const initIPFS = require("./resolver").initIPFS
const initWeb3 = require("./resolver").initWeb3

initIPFS()
initWeb3()

fastify.register(
  require('./routes'), {
    prefix: '/api/v1'
  }
)

// Run the server!
const start = async () => {
  try {
    await fastify.listen(3000, '0.0.0.0')
    fastify.swagger()
    fastify.log.info(`server listening on ${fastify.server.address().port}`)
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
}
start()