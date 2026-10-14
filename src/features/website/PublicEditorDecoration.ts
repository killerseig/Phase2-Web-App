import { defineComponent } from 'vue'
// Public builds never provide editing capabilities. Private builds keep the
// actual editor components; public rendering needs no handles, guides or editor.
export default defineComponent({ name: 'PublicEditorDecoration', render: () => null })
