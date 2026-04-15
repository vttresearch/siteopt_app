import { ref } from 'vue'

const isOpen = ref(false)
const options = ref({})
let resolver = null

export function useConfirmPrompt() {
  function confirm(opts) {
    options.value = {
      title: opts.title,
      message: opts.message,
      confirmText: opts.confirmText ?? "Confirm",
      cancelText: opts.cancelText ?? "Cancel",
      returnFocusEl: opts.returnFocusEl ?? null,
      variant: opts.variant ?? "danger",
    }

    isOpen.value = true

    return new Promise(resolve => {
      resolver = resolve
    })
  }

  function onConfirm() {
    isOpen.value = false
    resolver?.(true)
  }

  function onCancel() {
    isOpen.value = false
    resolver?.(false)
  }

  return {
    // state
    isOpen,
    options,

    // actions
    confirm,
    onConfirm,
    onCancel
  }
}
