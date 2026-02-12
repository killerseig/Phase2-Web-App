<template>
  <div class="admin-data-migration">
    <div class="section">
      <h2>Data Migration & Plexis Integration</h2>
      <p class="text-muted">Phase 3F: Migrate legacy data and setup Plexis integration</p>
    </div>

    <!-- Migration Section -->
    <div class="card mb-4">
      <div class="card-header bg-primary text-white">
        <h5 class="mb-0">Data Migration</h5>
      </div>
      <div class="card-body">
        <p class="text-muted">
          Migrate legacy data structure to job-scoped collections:
        </p>

        <div class="migration-status mb-3">
          <div v-if="!migrationStarted" class="alert alert-info">
            <strong>Ready to migrate:</strong>
            <ul class="mb-0 mt-2">
              <li>Legacy timecards → jobs/{jobId}/timecards/</li>
              <li>Legacy daily logs → jobs/{jobId}/dailyLogs/</li>
              <li>Employee references → job rosters</li>
            </ul>
          </div>

          <div v-if="migrationInProgress" class="alert alert-warning">
            <strong>Migration in progress...</strong>
            <div class="progress mt-2">
              <div
                class="progress-bar progress-bar-striped progress-bar-animated"
                role="progressbar"
                style="width: 100%"
              />
            </div>
          </div>

          <div v-if="migrationComplete" class="alert alert-success">
            <h6>Migration Complete!</h6>
            <ul class="mb-0 mt-2">
              <li>✓ Timecards migrated: {{ migrationResults.timecardsMigrated }}</li>
              <li>✓ Daily logs migrated: {{ migrationResults.dailyLogsMigrated }}</li>
              <li>✓ Rosters created: {{ migrationResults.rostersCreated }}</li>
              <li>Duration: {{ migrationDuration }}</li>
            </ul>
            <div v-if="migrationResults.errors?.length > 0" class="alert alert-danger mt-2 mb-0">
              <strong>Errors:</strong>
              <ul class="mb-0">
                <li v-for="(err, idx) in migrationResults.errors" :key="idx">
                  {{ err }}
                </li>
              </ul>
            </div>
          </div>

          <div v-if="migrationError" class="alert alert-danger">
            <strong>Migration Error:</strong>
            <p class="mb-0 mt-2">{{ migrationError }}</p>
          </div>
        </div>

        <button
          @click="runMigration"
          :disabled="migrationInProgress || migrationComplete"
          class="btn btn-primary"
        >
          <span v-if="!migrationInProgress">Run Full Migration</span>
          <span v-else>
            <span class="spinner-border spinner-border-sm me-2" />
            Migrating...
          </span>
        </button>

        <button
          @click="verifyMigration"
          :disabled="!migrationComplete"
          class="btn btn-outline-secondary ms-2"
        >
          Verify Migration
        </button>
      </div>
    </div>

    <!-- Plexis Export Section -->
    <div class="card mb-4">
      <div class="card-header bg-success text-white">
        <h5 class="mb-0">Plexis Export</h5>
      </div>
      <div class="card-body">
        <p class="text-muted">
          Export timecards to Plexis CSV format for payroll processing
        </p>

        <div class="row mb-3">
          <div class="col-md-6">
            <label class="form-label">Select Job</label>
            <select v-model="selectedJobId" class="form-select">
              <option value="">-- Choose a job --</option>
              <option v-for="job in jobs" :key="job.id" :value="job.id">
                {{ job.code }} - {{ job.name }}
              </option>
            </select>
          </div>
          <div class="col-md-6">
            <label class="form-label">Select Week</label>
            <input
              v-model="selectedWeekDate"
              type="date"
              class="form-control"
              placeholder="Select week ending date"
            />
          </div>
        </div>

        <div v-if="plexisExportData" class="alert alert-info">
          <strong>Preview:</strong>
          <pre class="bg-light p-2 mt-2 small">{{ plexisExportData.substring(0, 500) }}...</pre>
        </div>

        <button
          @click="exportToPlexis"
          :disabled="!selectedJobId || !selectedWeekDate"
          class="btn btn-success"
        >
          <i class="bi bi-download me-1" />
          Export to Plexis
        </button>
      </div>
    </div>

    <!-- Plexis Import Section -->
    <div class="card">
      <div class="card-header bg-info text-white">
        <h5 class="mb-0">Plexis Import</h5>
      </div>
      <div class="card-body">
        <p class="text-muted">
          Import employees from Plexis CSV format into a job roster
        </p>

        <div class="mb-3">
          <label class="form-label">Select Job for Import</label>
          <select v-model="selectedJobIdForImport" class="form-select">
            <option value="">-- Choose a job --</option>
            <option v-for="job in jobs" :key="job.id" :value="job.id">
              {{ job.code }} - {{ job.name }}
            </option>
          </select>
        </div>

        <div class="mb-3">
          <label for="csvFile" class="form-label">Upload Plexis CSV</label>
          <input
            id="csvFile"
            type="file"
            accept=".csv"
            class="form-control"
            @change="onFileSelected"
          />
          <small class="text-muted d-block mt-2">
            Expected columns: EmployeeID, FirstName, LastName, Classification, Status
          </small>
        </div>

        <div v-if="csvValidation && !csvValidation.valid" class="alert alert-danger">
          <strong>CSV Validation Errors:</strong>
          <ul class="mb-0 mt-2">
            <li v-for="(err, idx) in csvValidation.errors" :key="idx">
              {{ err }}
            </li>
          </ul>
        </div>

        <div v-if="csvValidation?.warnings?.length > 0" class="alert alert-warning">
          <strong>CSV Warnings:</strong>
          <ul class="mb-0">
            <li v-for="(warn, idx) in csvValidation.warnings" :key="idx">
              {{ warn }}
            </li>
          </ul>
        </div>

        <div v-if="importedEmployees" class="alert alert-info">
          <strong>Preview:</strong> {{ importedEmployees.length }} employees ready to import
          <div class="mt-2 small">
            <div v-for="emp in importedEmployees.slice(0, 3)" :key="emp.id">
              • {{ emp.employeeNumber }}: {{ emp.firstName }} {{ emp.lastName }}
            </div>
            <div v-if="importedEmployees.length > 3" class="text-muted">
              ... and {{ importedEmployees.length - 3 }} more
            </div>
          </div>
        </div>

        <button
          @click="importFromPlexis"
          :disabled="!selectedJobIdForImport || !importedEmployees || importInProgress"
          class="btn btn-info"
        >
          <span v-if="!importInProgress">
            <i class="bi bi-upload me-1" />
            Import to Job Roster
          </span>
          <span v-else>
            <span class="spinner-border spinner-border-sm me-2" />
            Importing...
          </span>
        </button>

        <div v-if="importStatus" class="alert mt-3" :class="importStatus.success ? 'alert-success' : 'alert-danger'">
          {{ importStatus.message }}
        </div>
      </div>
    </div>

    <!-- Toast notification -->
    <Toast ref="toastRef" />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import Toast from '../../components/Toast.vue'
import { useJobsStore } from '../../stores/jobs'
import {
  runFullDataMigration,
  verifyMigration as verifyMigrationData,
} from '../../utils/migration'
import {
  exportTimecardsToCsv,
  importEmployeesFromCsv,
  downloadCsv,
  validatePlexisCsv,
} from '../../utils/plexisIntegration'
import { addRosterEmployee, listTimecardsByJobAndWeek } from '@/services'
import type { JobRosterEmployee } from '../../types/models'

const toastRef = ref<InstanceType<typeof Toast> | null>(null)
const jobsStore = useJobsStore()

// Migration state
const migrationStarted = ref(false)
const migrationInProgress = ref(false)
const migrationComplete = ref(false)
const migrationError = ref('')
const migrationResults = ref<any>({})
const migrationStartTime = ref<Date | null>(null)

// Export state
const selectedJobId = ref('')
const selectedWeekDate = ref('')
const plexisExportData = ref('')

// Import state
const selectedJobIdForImport = ref('')
const csvValidation = ref<any>(null)
const importedEmployees = ref<JobRosterEmployee[]>([])
const importInProgress = ref(false)
const importStatus = ref<{ success: boolean; message: string } | null>(null)

const jobs = computed(() => jobsStore.allJobs)

const migrationDuration = computed(() => {
  if (!migrationResults.value?.startTime || !migrationResults.value?.endTime) {
    return ''
  }
  const ms =
    new Date(migrationResults.value.endTime).getTime() -
    new Date(migrationResults.value.startTime).getTime()
  return `${(ms / 1000).toFixed(2)}s`
})

async function runMigration() {
  migrationInProgress.value = true
  migrationError.value = ''
  migrationStartTime.value = new Date()

  try {
    migrationResults.value = await runFullDataMigration()
    migrationComplete.value = true
    migrationStarted.value = true
    toastRef.value?.show('Migration completed successfully', 'success')
  } catch (error: any) {
    migrationError.value = error?.message ?? 'Migration failed'
    toastRef.value?.show('Migration failed', 'error')
  } finally {
    migrationInProgress.value = false
  }
}

async function verifyMigration() {
  try {
    const verified = await verifyMigrationData()
    if (verified) {
      toastRef.value?.show('Migration verification passed ✓', 'success')
    } else {
      toastRef.value?.show('Migration verification failed', 'warning')
    }
  } catch (error: any) {
    toastRef.value?.show('Verification error', 'error')
  }
}

async function exportToPlexis() {
  try {
    if (!selectedJobId.value || !selectedWeekDate.value) return

    const timecards = await listTimecardsByJobAndWeek(
      selectedJobId.value,
      selectedWeekDate.value
    )

    const job = jobs.value.find((j) => j.id === selectedJobId.value)
    const jobCode = job?.code ?? 'UNKNOWN'

    const csvContent = exportTimecardsToCsv(timecards, jobCode)
    plexisExportData.value = csvContent

    downloadCsv(csvContent, `plexis-timecards-${selectedWeekDate.value}.csv`)
    toastRef.value?.show('Timecards exported to Plexis', 'success')
  } catch (error: any) {
    toastRef.value?.show(error?.message ?? 'Export failed', 'error')
  }
}

function onFileSelected(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]

  if (!file) return

  const reader = new FileReader()
  reader.onload = (e) => {
    const content = e.target?.result as string
    csvValidation.value = validatePlexisCsv(content)

    if (csvValidation.value.valid) {
      importedEmployees.value = importEmployeesFromCsv(content)
    } else {
      importedEmployees.value = []
    }
  }
  reader.readAsText(file)
}

async function importFromPlexis() {
  if (!selectedJobIdForImport.value || !importedEmployees.value?.length) return

  importInProgress.value = true
  importStatus.value = null

  try {
    let imported = 0
    for (const employee of importedEmployees.value) {
      try {
        // Set jobId before adding to roster
        const employeeWithJob = { ...employee, jobId: selectedJobIdForImport.value }
        await addRosterEmployee(selectedJobIdForImport.value, employeeWithJob)
        imported++
      } catch (err) {
        console.warn(`Failed to import employee ${employee.employeeNumber}:`, err)
      }
    }

    importStatus.value = {
      success: true,
      message: `Successfully imported ${imported}/${importedEmployees.value.length} employees`,
    }
    toastRef.value?.show('Employees imported successfully', 'success')
  } catch (error: any) {
    importStatus.value = {
      success: false,
      message: error?.message ?? 'Import failed',
    }
    toastRef.value?.show('Import failed', 'error')
  } finally {
    importInProgress.value = false
  }
}

onMounted(async () => {
  await jobsStore.fetchAllJobs(true)
})
</script>

<style scoped>
.admin-data-migration {
  padding: 20px;
}

.section {
  margin-bottom: 30px;
}

.section h2 {
  color: #333;
  margin-bottom: 5px;
}

.migration-status {
  margin-bottom: 15px;
}

.card-header {
  font-weight: 500;
}

pre {
  max-height: 200px;
  overflow-y: auto;
  border-radius: 4px;
  font-size: 11px;
}

.btn {
  margin-top: 10px;
}
</style>
