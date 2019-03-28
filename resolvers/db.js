'use strict'

const level = require('level')

let db = {}

module.exports.openLevel = (location, options) => {
    if (!db) {
        console.log('db is alreay initialized or something wrong')
        return false
    }
    db = level(location, options)
}

module.exports.getLevel = () => {
    if (!db) {
        return new Error('db is not initialized')
    }
    return db
}