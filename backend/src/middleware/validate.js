'use strict';

function validate(schema, source = 'query') {
  return (req, res, next) => {
    const result = schema.safeParse(req[source])
    if (!result.success) {
      return res.status(400).json({
        ok: false,
        error: result.error.issues.map(i => i.message).join(', '),
      })
    }
    req[source] = result.data
    next()
  }
}

module.exports = { validate }
