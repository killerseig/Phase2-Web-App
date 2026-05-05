import { createApp, defineComponent, h } from 'vue'
import { createPinia } from 'pinia'
import PrimeVue from 'primevue/config'
import ToastService from 'primevue/toastservice'
import Toast from 'primevue/toast'
import Aura from '@primeuix/themes/aura'
import 'primeicons/primeicons.css'

import App from './App.vue'
import router from './router'
import './styles/main.css'

window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault()
  window.location.reload()
})

const app = createApp(App)

app.use(createPinia())
app.use(PrimeVue, {
  ripple: false,
  theme: {
    preset: Aura,
    options: {
      darkModeSelector: '.app-theme-dark',
      cssLayer: false,
    },
  },
  unstyled: true,
})
app.use(ToastService)
app.use(router)

app.mount('#app')

const toastHost = document.createElement('div')
toastHost.id = 'app-toast-root'
document.body.appendChild(toastHost)

const toastApp = createApp(
  defineComponent({
    name: 'AppToastHost',
    render: () => h(Toast, { group: 'app', position: 'top-right' }),
  }),
)

toastApp.use(PrimeVue, {
  ripple: false,
  theme: {
    preset: Aura,
    options: {
      darkModeSelector: 'none',
      cssLayer: false,
    },
  },
})

toastApp.mount('#app-toast-root')
