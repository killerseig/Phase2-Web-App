<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Button from 'primevue/button'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { getCurrentRoleLabel } from '@/auth/capabilities'
import { useAuthStore } from '@/stores/auth'

type NavigationItem = {
  label: string
  to: string
}

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()
const mobileNavOpen = ref(false)

const workspaceNavigationItems = computed<NavigationItem[]>(() => [
  { label: 'Jobs', to: '/jobs' },
])

const adminNavigationItems = computed<NavigationItem[]>(() => [
  { label: 'Users', to: '/users' },
  { label: 'Employees', to: '/employees' },
  { label: 'Timecard Export', to: '/exports/timecards' },
  { label: 'Shop Catalog', to: '/settings/shop-catalog' },
])

const roleLabel = computed(() => getCurrentRoleLabel(auth.rawRole))

function openMobileNav() {
  mobileNavOpen.value = true
}

function closeMobileNav() {
  mobileNavOpen.value = false
}

async function handleSignOut() {
  closeMobileNav()
  await auth.signOut()
  await router.push('/login')
}

watch(() => route.fullPath, () => {
  closeMobileNav()
})
</script>

<template>
  <div class="app-shell" :class="{ 'app-shell--mobile-nav-open': mobileNavOpen }">
    <button
      class="app-shell__sidebar-backdrop"
      type="button"
      :tabindex="mobileNavOpen ? 0 : -1"
      aria-label="Close navigation"
      @click="closeMobileNav"
    ></button>

    <aside id="app-shell-navigation" class="app-shell__sidebar">
      <div class="app-shell__brand">
        <div class="app-shell__logo">P2</div>
        <div class="app-shell__brand-copy">
          <div class="app-shell__brand-title">Phase 2</div>
          <div class="app-shell__brand-subtitle">Field Operations</div>
        </div>
        <Button class="app-shell__sidebar-close" type="button" aria-label="Close navigation" @click="closeMobileNav">
          <i class="pi pi-times app-shell__control-icon" aria-hidden="true"></i>
        </Button>
      </div>

      <div class="app-shell__sidebar-main">
        <div class="app-shell__section-label">Navigation</div>
        <nav class="app-shell__nav">
          <RouterLink
            v-for="item in workspaceNavigationItems"
            :key="item.to"
            :to="item.to"
            class="app-shell__nav-link"
            active-class="app-shell__nav-link--active"
            @click="closeMobileNav"
          >
            {{ item.label }}
          </RouterLink>
        </nav>
      </div>

      <div class="app-shell__sidebar-footer">
        <div v-if="auth.isAdmin" class="app-shell__sidebar-admin">
          <div class="app-shell__section-label">Admin</div>
          <nav class="app-shell__nav">
            <RouterLink
              v-for="item in adminNavigationItems"
              :key="item.to"
              :to="item.to"
              class="app-shell__nav-link"
              active-class="app-shell__nav-link--active"
              @click="closeMobileNav"
            >
              {{ item.label }}
            </RouterLink>
          </nav>
        </div>
        <div class="app-shell__sidebar-signout">
          <button
            class="app-shell__nav-link app-shell__sidebar-signout-button"
            type="button"
            @click="handleSignOut"
          >
            Sign Out
          </button>
        </div>
      </div>
    </aside>

    <div class="app-shell__body">
      <header class="app-shell__topbar">
        <div class="app-shell__topbar-leading">
          <Button
            class="app-shell__menu-button"
            :class="{ 'app-shell__menu-button--open': mobileNavOpen }"
            type="button"
            :aria-expanded="mobileNavOpen ? 'true' : 'false'"
            aria-controls="app-shell-navigation"
            :aria-label="mobileNavOpen ? 'Close navigation' : 'Open navigation'"
            @click="mobileNavOpen ? closeMobileNav() : openMobileNav()"
          >
            <i :class="['pi', mobileNavOpen ? 'pi-times' : 'pi-bars', 'app-shell__control-icon']" aria-hidden="true"></i>
            <span class="sr-only">Menu</span>
          </Button>
          <div class="app-shell__topbar-title">
            <span class="app-shell__topbar-eyebrow">Phase 2 Console</span>
            <strong class="app-shell__topbar-heading">Field Operations</strong>
          </div>
        </div>

        <div class="app-shell__topbar-meta">
          <slot name="topbar-actions" />
          <div class="app-shell__topbar-chip app-shell__topbar-chip--role">
            {{ roleLabel }}
          </div>
        </div>
      </header>

      <main class="app-shell__content">
        <slot />
      </main>

      <footer class="app-shell__statusbar">
        <span>Ready</span>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.app-shell {
  display: grid;
  grid-template-columns: 278px minmax(0, 1fr);
  height: 100vh;
  position: relative;
  background:
    linear-gradient(90deg, rgba(145, 220, 255, 0.045) 0 1px, transparent 1px 100%),
    linear-gradient(180deg, rgba(145, 220, 255, 0.035) 0 1px, transparent 1px 100%),
    radial-gradient(circle at 30% -10%, rgba(99, 199, 230, 0.12), transparent 34%),
    radial-gradient(circle at 95% 12%, rgba(239, 180, 93, 0.08), transparent 24%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.024), rgba(255, 255, 255, 0)),
    var(--bg);
  background-size:
    72px 72px,
    72px 72px,
    auto,
    auto,
    auto,
    auto;
  overflow: hidden;
}

.app-shell__sidebar-backdrop {
  display: none;
}

.app-shell__sidebar {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding: 1.25rem 1.1rem 0.95rem;
  background:
    radial-gradient(circle at 18% 0%, rgba(99, 199, 230, 0.16), transparent 32%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.045), rgba(255, 255, 255, 0)),
    rgba(12, 21, 30, 0.975);
  border-right: 1px solid rgba(168, 190, 209, 0.2);
  box-shadow:
    inset -1px 0 0 rgba(255, 255, 255, 0.045),
    18px 0 52px rgba(2, 7, 12, 0.26);
  min-height: 0;
  overflow: hidden;
}

.app-shell__sidebar-main {
  display: flex;
  flex: 1 1 auto;
  min-height: 0;
  flex-direction: column;
  gap: var(--space-3);
  overflow: auto;
  padding-right: 0.1rem;
}

.app-shell__sidebar-close,
.app-shell__menu-button {
  display: none;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  min-width: 2.5rem;
  height: 2.5rem;
  min-height: 2.5rem;
  padding: 0;
  border: 1px solid transparent;
  border-radius: 4px;
  background: transparent;
  color: rgba(214, 223, 232, 0.78);
  box-shadow: none;
  transition:
    border-color 0.16s ease,
    background-color 0.16s ease,
    color 0.16s ease,
    transform 0.16s ease;
  cursor: pointer;
}

.app-shell__sidebar-close {
  margin-left: auto;
}

.app-shell__sidebar-close:hover,
.app-shell__menu-button:hover {
  border-color: rgba(186, 198, 211, 0.14);
  background: rgba(255, 255, 255, 0.04);
  color: rgba(238, 244, 250, 0.96);
}

.app-shell__sidebar-close:focus-visible,
.app-shell__menu-button:focus-visible {
  outline: none;
  border-color: rgba(123, 183, 223, 0.28);
  box-shadow: 0 0 0 2px rgba(88, 186, 233, 0.14);
}

.app-shell__control-icon {
  font-size: 0.95rem;
  line-height: 1;
}

.app-shell__brand {
  display: flex;
  align-items: center;
  gap: 0.95rem;
  padding: 0.2rem 0.1rem 1.05rem;
  border-bottom: 1px solid rgba(168, 190, 209, 0.16);
}

.app-shell__logo {
  display: grid;
  place-items: center;
  width: 2.85rem;
  height: 2.85rem;
  border: 1px solid var(--border-strong);
  border-radius: 15px;
  color: var(--accent-strong);
  background:
    radial-gradient(circle at 30% 20%, rgba(255, 255, 255, 0.24), transparent 26%),
    linear-gradient(145deg, rgba(145, 220, 255, 0.32), rgba(99, 199, 230, 0.06)),
    rgba(255, 255, 255, 0.035);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.13),
    0 12px 28px rgba(0, 0, 0, 0.26),
    var(--glow-accent);
  font-weight: 800;
  letter-spacing: 0.08em;
}

.app-shell__brand-copy {
  display: grid;
  gap: 0.08rem;
}

.app-shell__brand-title {
  font-size: 1.06rem;
  font-weight: 800;
  letter-spacing: -0.025em;
}

.app-shell__brand-subtitle {
  color: var(--text-soft);
  font-size: 0.76rem;
  text-transform: uppercase;
  letter-spacing: 0.16em;
}

.app-shell__section-label {
  color: var(--text-soft);
  font-size: 0.66rem;
  text-transform: uppercase;
  letter-spacing: 0.18em;
  padding: 0.2rem 0.28rem 0;
}

.app-shell__nav {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.app-shell__nav-link {
  display: flex;
  align-items: center;
  min-height: 2.7rem;
  padding: 0 0.95rem;
  border: 1px solid rgba(168, 190, 209, 0.09);
  border-radius: 15px;
  color: var(--text-muted);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.024), rgba(255, 255, 255, 0.006)),
    rgba(255, 255, 255, 0.018);
  font-weight: 600;
  letter-spacing: -0.015em;
  transition:
    border-color 0.2s ease,
    color 0.2s ease,
    background 0.2s ease,
    box-shadow 0.2s ease,
    transform 0.2s ease;
}

.app-shell__nav-link:hover,
.app-shell__nav-link--active {
  color: var(--text);
  border-color: rgba(145, 220, 255, 0.38);
  background:
    radial-gradient(circle at 12% 16%, rgba(145, 220, 255, 0.14), transparent 28%),
    linear-gradient(135deg, rgba(45, 77, 96, 0.96), rgba(23, 41, 54, 0.96)),
    rgba(99, 199, 230, 0.12);
  box-shadow:
    inset 3px 0 0 rgba(145, 220, 255, 0.92),
    0 10px 22px rgba(3, 10, 16, 0.18),
    0 0 0 1px rgba(255, 255, 255, 0.025);
  transform: translateY(-1px);
}

.app-shell__sidebar-admin {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  padding-top: 0.85rem;
  border-top: 1px solid rgba(168, 190, 209, 0.14);
}

.app-shell__sidebar-footer {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  flex: 0 0 auto;
  margin-top: auto;
  padding-top: 0.85rem;
  border-top: 1px solid rgba(168, 190, 209, 0.14);
}

.app-shell__sidebar-footer .app-shell__sidebar-admin {
  padding-top: 0;
  border-top: 0;
}

.app-shell__sidebar-signout {
  padding-top: 0.75rem;
  border-top: 1px solid var(--border);
}

.app-shell__sidebar-signout-button {
  width: 100%;
  justify-content: center;
  font: inherit;
  cursor: pointer;
}

.app-shell__body {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  min-width: 0;
  min-height: 0;
}

.app-shell__topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  min-height: 4.25rem;
  padding: 0.6rem 1.35rem;
  border-bottom: 1px solid rgba(168, 190, 209, 0.17);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.045), rgba(255, 255, 255, 0)),
    rgba(13, 22, 31, 0.82);
  backdrop-filter: blur(16px);
  box-shadow: 0 16px 36px rgba(2, 7, 12, 0.16);
}

.app-shell__topbar-leading {
  display: flex;
  align-items: center;
  min-width: 0;
  gap: 0.8rem;
}

.app-shell__topbar-title {
  display: grid;
  gap: 0.08rem;
  min-width: 0;
}

.app-shell__topbar-eyebrow {
  color: var(--accent);
  font-size: 0.66rem;
  font-weight: 800;
  letter-spacing: 0.18em;
  line-height: 1;
  text-transform: uppercase;
}

.app-shell__topbar-heading {
  color: var(--text);
  font-size: 1rem;
  line-height: 1.15;
  letter-spacing: -0.03em;
}

.app-shell__menu-button--open {
  border-color: rgba(111, 175, 218, 0.18);
  background: rgba(88, 186, 233, 0.08);
  color: rgba(223, 236, 246, 0.96);
}

.app-shell__topbar-meta {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.app-shell__topbar-chip {
  display: inline-flex;
  align-items: center;
  min-height: 1.9rem;
  padding: 0 0.78rem;
  border: 1px solid rgba(168, 190, 209, 0.17);
  border-radius: 999px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.055), rgba(255, 255, 255, 0.02)),
    rgba(255, 255, 255, 0.035);
  color: var(--text-muted);
  font-size: 0.69rem;
  font-weight: 750;
  text-transform: uppercase;
  letter-spacing: 0.12em;
}

.app-shell__topbar-chip--role {
  color: var(--accent-strong);
  border-color: rgba(99, 199, 230, 0.36);
  background:
    linear-gradient(180deg, rgba(99, 199, 230, 0.2), rgba(29, 79, 95, 0.16)),
    rgba(29, 79, 95, 0.24);
}

:slotted(.app-shell__topbar-button) {
  min-height: 1.95rem;
  padding: 0 0.9rem;
  border-radius: 10px;
}

.app-shell__content {
  min-width: 0;
  min-height: 0;
  padding: 1.15rem;
  overflow: auto;
  background:
    radial-gradient(circle at 72% -14%, rgba(99, 199, 230, 0.1), transparent 30%),
    radial-gradient(circle at 98% 96%, rgba(239, 180, 93, 0.055), transparent 24%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.012), rgba(255, 255, 255, 0)),
    transparent;
}

.app-shell__statusbar {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  min-height: 2rem;
  padding: 0.25rem 1.1rem;
  border-top: 1px solid rgba(168, 190, 209, 0.13);
  background: rgba(10, 18, 26, 0.92);
  color: var(--text-soft);
  font-size: 0.62rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.18em;
  align-items: center;
}

@media (max-width: 1100px) {
  .app-shell {
    grid-template-columns: 236px minmax(0, 1fr);
  }
}

@media (max-width: 820px) {
  .app-shell {
    grid-template-columns: 1fr;
    position: relative;
  }

  .app-shell__sidebar {
    position: fixed;
    top: 0;
    left: 0;
    bottom: 0;
    z-index: 60;
    width: min(19.5rem, calc(100vw - 2.5rem));
    max-width: 100%;
    padding-bottom: 1rem;
    border-right: 1px solid var(--border);
    border-bottom: 0;
    box-shadow: var(--shadow);
    overflow: hidden;
    transform: translateX(calc(-100% - 1rem));
    transition: transform 0.22s ease;
  }

  .app-shell--mobile-nav-open .app-shell__sidebar {
    transform: translateX(0);
  }

  .app-shell__sidebar-backdrop {
    display: block;
    position: fixed;
    inset: 0;
    z-index: 50;
    border: 0;
    background: rgba(5, 11, 18, 0.52);
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.2s ease;
  }

  .app-shell--mobile-nav-open .app-shell__sidebar-backdrop {
    opacity: 1;
    pointer-events: auto;
  }

  .app-shell__sidebar-close {
    display: inline-grid;
    place-items: center;
  }

  .app-shell__topbar {
    min-height: 3.75rem;
  }

  .app-shell__menu-button {
    display: inline-flex;
  }

  .app-shell__topbar-title {
    display: none;
  }

  .app-shell__topbar-meta {
    justify-content: flex-end;
    min-width: 0;
  }

  .app-shell__nav {
    flex-direction: column;
    flex-wrap: nowrap;
  }

  .app-shell__nav-link {
    min-height: 2.4rem;
  }
}

@media (max-width: 560px) {
  .app-shell__topbar,
  .app-shell__content,
  .app-shell__statusbar,
  .app-shell__sidebar {
    padding-left: 1rem;
    padding-right: 1rem;
  }

  .app-shell__topbar {
    gap: 0.75rem;
  }

  .app-shell__topbar-meta {
    flex: 0 0 auto;
  }
}
</style>
