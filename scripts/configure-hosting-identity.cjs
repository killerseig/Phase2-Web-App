// One bounded setup for the approved Phase 2 identity. No keys or secret values.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict')
const { createRequire } = require('node:module'), { createHash } = require('node:crypto')
const root = path.resolve(__dirname, '..'), req = createRequire(path.join(root, 'package.json'))
process.chdir(root)
const project = 'phase2-website', number = '792793988588'
const email = `phase2-hosting-deployer@${project}.iam.gserviceaccount.com`
const pool = `projects/${number}/locations/global/workloadIdentityPools/phase2-github`
const provider = `${pool}/providers/github`, role = `projects/${project}/roles/phase2HostingDeploy`
const principal = `principalSet://iam.googleapis.com/${pool}/attribute.repository_id/1155096937`
const permissions = ['firebasehosting.sites.get', 'firebasehosting.sites.update']
const verifyOnly = process.argv[2] === '--verify'
const mapping = { 'google.subject': 'assertion.sub', 'attribute.repository_id': 'assertion.repository_id' }
const condition = "assertion.repository_id=='1155096937' && assertion.repository_owner_id=='29692310' && assertion.ref=='refs/heads/main' && assertion.event_name=='push' && assertion.workflow_ref=='killerseig/Phase2-Web-App/.github/workflows/phase2.yml@refs/heads/main'"
const journalPath = path.join(root, '.forms-local-data/deploy-identity-setup.json')
fs.mkdirSync(path.dirname(journalPath), { recursive: true })
const journal = fs.existsSync(journalPath) ? JSON.parse(fs.readFileSync(journalPath)) : { project, number, email, role, pool, provider, actions: [] }
function save() { journal.updatedAt = new Date().toISOString(); fs.writeFileSync(journalPath, JSON.stringify(journal, null, 2)) }
function equalMembers(bindings) { return JSON.stringify((bindings || []).map(binding => ({ ...binding, members: [...(binding.members || [])].sort() })).sort((a,b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))) }
async function change(label, fn) {
  assert(!verifyOnly, 'Verification found missing configuration: ' + label + '; no mutation attempted')
  const action = { label, startedAt: new Date().toISOString(), state: 'UNCERTAIN_UNTIL_CONFIRMED' }
  journal.actions.push(action); save()
  console.log('Starting: ' + label)
  try { const result = await fn(); action.state = 'CONFIRMED'; action.completedAt = new Date().toISOString(); save(); console.log('Confirmed: ' + label); return result }
  catch (error) { action.state = 'FAILED_OR_UNCERTAIN_INSPECT_BEFORE_RETRY'; action.message = error.message; save(); throw error }
}
;(async () => {
  assert(['--verify', '--apply-approved-scope'].includes(process.argv[2]), 'Use --verify for read-only inspection, or --apply-approved-scope only with specific approval')
  await req('firebase-tools/lib/commands/hosting-channel-list').command.runner()({ project, site: project, cwd: root, nonInteractive: true, json: true })
  const { Client } = req('firebase-tools/lib/apiv2')
  const iam = new Client({ urlPrefix: 'https://iam.googleapis.com', apiVersion: 'v1', auth: true })
  const usage = new Client({ urlPrefix: 'https://serviceusage.googleapis.com', apiVersion: 'v1', auth: true })
  const resource = new Client({ urlPrefix: 'https://cloudresourcemanager.googleapis.com', apiVersion: 'v1', auth: true })
  async function get(client, requestPath) { return (await client.get(requestPath)).body }
  async function optional(client, requestPath) { try { return await get(client, requestPath) } catch(error) { if (error.status === 404 || error.context?.response?.statusCode === 404) return null; throw error } }
  async function operation(client, value) {
    for (let i=0; !value.done && i<45; i++) { await new Promise(resolve => setTimeout(resolve, 1000)); value = await get(client, '/' + value.name) }
    assert(value.done, 'Operation still pending; inspect before retrying')
    assert(!value.error, value.error?.message || 'Operation failed')
    return value.response
  }
  // Reconcile all named resources before any creation; unexpected scope stops setup.
  const servicePath = `/projects/${number}/services/sts.googleapis.com`
  const api = await get(usage, servicePath)
  const accountPath = `/projects/${project}/serviceAccounts/${email}`
  let account = await optional(iam, accountPath), existingRole = await optional(iam, '/' + role)
  let existingPool = await optional(iam, '/' + pool), existingProvider = existingPool ? await optional(iam, '/' + provider) : null
  if (account) { assert.equal(account.email, email); assert(!account.disabled) }
  if (existingRole) assert.deepEqual([...existingRole.includedPermissions].sort(), permissions)
  if (existingPool) { assert.equal(existingPool.state, 'ACTIVE'); assert(!existingPool.disabled) }
  if (existingProvider) { assert.deepEqual(existingProvider.attributeMapping, mapping); assert.equal(existingProvider.attributeCondition, condition); assert.equal(existingProvider.oidc.issuerUri, 'https://token.actions.githubusercontent.com'); assert(!existingProvider.disabled) }
  if (api.state !== 'ENABLED') await change('Enable STS API only', async () => operation(usage, (await usage.post(servicePath + ':enable', {})).body))
  assert.equal((await get(usage, servicePath)).state, 'ENABLED')
  if (!account) account = await change('Create dedicated Hosting service account', async () => (await iam.post(`/projects/${project}/serviceAccounts`, { accountId: 'phase2-hosting-deployer', serviceAccount: { displayName: 'Phase 2 GitHub Hosting deployer', description: 'Keyless main-only employee Hosting releases; no business-data or backend access.' } })).body)
  if (!existingRole) existingRole = await change('Create two-permission Hosting custom role', async () => (await iam.post(`/projects/${project}/roles`, { roleId: 'phase2HostingDeploy', role: { title: 'Phase 2 Hosting deployment', description: 'Read and update existing Firebase Hosting only.', includedPermissions: permissions, stage: 'GA' } })).body)
  if (!existingPool) existingPool = await change('Create dedicated workload identity pool', async () => operation(iam, (await iam.post(`/projects/${number}/locations/global/workloadIdentityPools`, { displayName: 'Phase 2 GitHub main', description: 'Dedicated keyless trust for the reviewed Phase 2 release workflow.' }, { queryParams: { workloadIdentityPoolId: 'phase2-github' } })).body))
  if (!existingProvider) existingProvider = await change('Create restricted GitHub OIDC provider', async () => operation(iam, (await iam.post('/' + pool + '/providers', { displayName: 'GitHub Phase 2 main release', oidc: { issuerUri: 'https://token.actions.githubusercontent.com' }, attributeMapping: mapping, attributeCondition: condition }, { queryParams: { workloadIdentityPoolProviderId: 'github' } })).body))
  async function bind(client, requestPath, binding, label) {
    const before = (await client.post(requestPath + ':getIamPolicy', { options: { requestedPolicyVersion: 3 } })).body
    const bindings = [...(before.bindings || [])]
    const same = bindings.find(item => item.role === binding.role && !item.condition)
    if (same?.members?.includes(binding.members[0])) return { alreadyPresent: true }
    if (same) { assert.equal(same.members?.length || 0, 0, 'Unexpected members on dedicated role; inspect before changing'); same.members = binding.members }
    else bindings.push(binding)
    const expected = { ...before, bindings }
    await change(label, async () => client.post(requestPath + ':setIamPolicy', { policy: expected }))
    const after = (await client.post(requestPath + ':getIamPolicy', { options: { requestedPolicyVersion: 3 } })).body
    assert.equal(equalMembers(after.bindings), equalMembers(expected.bindings), 'IAM differs from exact intended addition')
    return { previousPolicySha256: createHash('sha256').update(equalMembers(before.bindings)).digest('hex'), exactAdditionVerified: true }
  }
  journal.accountBinding = await bind(iam, accountPath, { role: 'roles/iam.workloadIdentityUser', members: [principal] }, 'Allow only restricted pool principal to impersonate dedicated account')
  journal.projectBinding = await bind(resource, `/projects/${project}`, { role, members: ['serviceAccount:' + email] }, 'Grant dedicated account the two-permission Hosting role only')
  const actualRole = await get(iam, '/' + role), actualProvider = await get(iam, '/' + provider)
  assert.deepEqual([...actualRole.includedPermissions].sort(), permissions)
  assert.deepEqual(actualProvider.attributeMapping, mapping); assert.equal(actualProvider.attributeCondition, condition)
  assert.equal(actualProvider.oidc.issuerUri, 'https://token.actions.githubusercontent.com'); assert(!actualProvider.disabled)
  assert.equal(actualProvider.state, 'ACTIVE')
  const accountPolicy = (await iam.post(accountPath + ':getIamPolicy', { options: { requestedPolicyVersion: 3 } })).body
  assert.equal(equalMembers(accountPolicy.bindings), equalMembers([{ role: 'roles/iam.workloadIdentityUser', members: [principal] }]), 'Dedicated account has unexpected direct trust bindings')
  const projectPolicy = (await resource.post(`/projects/${project}:getIamPolicy`, { options: { requestedPolicyVersion: 3 } })).body
  const accountGrants = projectPolicy.bindings.filter(binding => binding.members?.includes('serviceAccount:' + email))
  assert.equal(equalMembers(accountGrants), equalMembers([{ role, members: ['serviceAccount:' + email] }]), 'Dedicated account has unexpected project grants')
  const providers = await get(iam, '/' + pool + '/providers')
  assert.deepEqual(providers.workloadIdentityPoolProviders.map(item => item.name), [provider], 'Unexpected additional trust provider')
  const keys = await get(iam, accountPath + '/keys?keyTypes=USER_MANAGED')
  assert.equal((keys.keys || []).length, 0, 'A user-managed key exists; inspect without reading key values')
  journal.verified = { checkedAt: new Date().toISOString(), serviceAccount: account.email, permissions: actualRole.includedPermissions, provider: actualProvider.name, condition: actualProvider.attributeCondition, mapping: actualProvider.attributeMapping, stsEnabled: true, userManagedKeyCount: 0, noOtherCloudPermissionsGranted: true, mode: verifyOnly ? 'read-only verification' : 'approved configuration' }
  save(); console.log(JSON.stringify(journal.verified, null, 2))
})().catch(error => { console.error(error.message); process.exitCode = 1 })
