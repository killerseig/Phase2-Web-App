/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS smoke test patches dependencies before loading the compiled email service. */
const assert = require('node:assert/strict')
const axios = require('axios')
const config = require('../functionConfig.js')
config.emailEnabled.value = () => true
config.graphClientId.value = () => 'local-test-client'
config.graphTenantId.value = () => 'local-test-tenant'
config.graphClientSecret.value = () => 'local-test-secret'
config.outlookSenderEmail.value = () => 'app-sender@example.test'
let message
// All requests are intercepted here; this smoke test never contacts Graph or sends mail.
axios.post = async (url, payload) => {
  if (url === 'https://login.microsoftonline.com/local-test-tenant/oauth2/v2.0/token') return {data:{access_token:'local-test-token',expires_in:3600}}
  assert.equal(url,'https://graph.microsoft.com/v1.0/users/app-sender@example.test/sendMail')
  message = payload.message
  return {status:202}
}
const {sendEmail} = require('../emailService.js')
;(async()=>{
  await sendEmail({to:['office@example.test'],cc:['office@example.test','manager@example.test'],replyTo:'visitor@example.test',subject:'Website inquiry',html:'<p>Test</p>'})
  assert.deepEqual(message.toRecipients,[{emailAddress:{address:'office@example.test'}}])
  assert.deepEqual(message.ccRecipients,[{emailAddress:{address:'manager@example.test'}}])
  assert.deepEqual(message.replyTo,[{emailAddress:{address:'visitor@example.test'}}])
  assert.equal(message.from.emailAddress.address,'app-sender@example.test')
  await sendEmail({to:'office@example.test',subject:'Existing workflow',html:'<p>Test</p>'})
  assert.equal(message.ccRecipients,undefined)
  await assert.rejects(()=>sendEmail({to:'office@example.test',cc:['invalid'],subject:'Test',html:'Test'}))
  console.log('Website email routing smoke passed; Graph requests were mocked.')
})().catch(error=>{console.error(error);process.exitCode=1})
