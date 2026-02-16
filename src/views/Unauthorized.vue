<template>
  <div class="unauth-wrapper">
    <div class="unauth-card">
      <div class="unauth-title">Unauthorized</div>
      <p class="unauth-text">You do not have access to this page.</p>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/_variables.scss' as vars;

.unauth-wrapper {
  min-height: 100vh;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding-top: 10vh;
  background: var(--surface, vars.$surface);
}

.unauth-card {
  background: var(--surface-2, vars.$surface-2);
  border: 1px solid var(--border, vars.$border-color);
  border-radius: 12px;
  padding: 24px 28px;
  box-shadow: var(--shadow, vars.$box-shadow);
  text-align: center;
  max-width: 420px;
  width: 100%;
}

.unauth-title {
  font-size: 1.5rem;
  font-weight: 700;
  margin-bottom: 8px;
  color: var(--text-body, vars.$body-color);
}

.unauth-text {
  margin: 0;
  color: var(--text-muted, vars.$text-muted);
  font-size: 0.975rem;
}
</style>
