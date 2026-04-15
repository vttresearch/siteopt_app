<script setup>
import { onMounted, onUnmounted, ref, watch, computed } from "vue"

const props = defineProps({
  modelValue: { type: Boolean, required: true }, // v-model for open/closed
  title: { type: String, default: "Do action?" },
  message: { type: String, default: "This action cannot be undone." },
  confirmText: { type: String, default: "Yes" },
  cancelText: { type: String, default: "Cancel" },
  closeOnBackdrop: { type: Boolean, default: true },
  returnFocusEl: { type: Object, default: null },
  variant: {
    type: String,
    default: "danger",
  }
})

const emit = defineEmits(["update:modelValue", "confirm", "cancel"])

const panelRef = ref(null)
const variantMap = {
  danger: {
    icon: "fa-circle-exclamation",
    iconBg: "bg-red-100",
    iconColor: "text-red-600",
    confirmBtn: "bg-red-600 hover:bg-red-700 focus-visible:ring-red-500"
  },
  warning: {
    icon: "fa-triangle-exclamation",
    iconBg: "bg-yellow-100",
    iconColor: "text-yellow-600",
    confirmBtn: "bg-yellow-500 hover:bg-yellow-600 focus-visible:ring-yellow-400"
  },
  info: {
    icon: "fa-circle-info",
    iconBg: "bg-blue-100",
    iconColor: "text-blue-600",
    confirmBtn: "bg-blue-600 hover:bg-blue-700 focus-visible:ring-blue-500"
  },
  neutral: {
    icon: "fa-circle-question",
    iconBg: "bg-gray-100",
    iconColor: "text-gray-600",
    confirmBtn: "bg-gray-700 hover:bg-gray-800 focus-visible:ring-gray-500"
  }
}

const styles = computed(() => variantMap[props.variant] ?? variantMap.danger)


const close = () => emit("update:modelValue", false)
const onCancel = () => {
  emit("cancel")
  close()
  restoreFocus()
}
const onConfirm = () => {
  emit("confirm")
  close()
  restoreFocus()
}

let lastActive = null

const saveFocus = () => {
  lastActive = document.activeElement
}
const restoreFocus = () => {
  const el = props.returnFocusEl || lastActive
  if (el && typeof el.focus === "function") {
    el.focus()
  }
}

// Basic focus management: focus the first button on open
watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      saveFocus()
      // next tick-ish focus
      setTimeout(() => {
        const firstBtn = panelRef.value?.querySelector("button")
        firstBtn?.focus?.()
      }, 0)
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }
  }
)

onMounted(() => {
  // Prevent background scroll (already handled in watch for open state)
})

onUnmounted(() => {
  document.body.style.overflow = ""
})
</script>

<template>
  <teleport to="body">
    <div
        v-if="modelValue"
        class="fixed inset-0 z-50 flex items-center justify-center"
        role="dialog"
        aria-modal="true"
        @keydown.esc.prevent="onCancel">
      <!-- Backdrop -->
      <div
          class="absolute inset-0 bg-black/40"
          @click="closeOnBackdrop && onCancel()">
      </div>

      <!-- Modal panel -->
      <div ref="panelRef" class="relative z-10 w-full max-w-md rounded-lg bg-white shadow-lg ring-1 ring-black/5">

        <!-- Header -->
        <div class="flex items-start gap-3 p-5">
          <!-- icon -->
          <div
              class="mt-1 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full"
              :class="[styles.iconBg, styles.iconColor]"
          >
            <i class="fa-solid text-xl" :class="styles.icon"></i>
          </div>
          <div class="flex-1">
            <h3 class="text-base font-semibold text-gray-900">
              {{ title }}
            </h3>
            <p class="mt-1 text-sm text-gray-600">
              {{ message }}
            </p>
          </div>
          <button
              type="button"
              class="ml-3 text-gray-400 hover:text-gray-600"
              @click="onCancel"
              aria-label="Close">
            <i class="fa-solid fa-xmark text-lg"></i>
          </button>
        </div>

        <!-- Footer -->
        <div class="flex justify-end gap-2 border-t border-gray-100 bg-gray-50 p-4">
          <button
              type="button"
              class="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
              @click="onCancel">
            {{ cancelText }}
          </button>
          <button
              type="button"
              class="inline-flex items-center justify-center rounded-md px-4 py-2
                text-sm font-semibold text-white focus:outline-none focus-visible:ring-2"
              :class="styles.confirmBtn"
              @click="onConfirm">
            {{ confirmText }}
          </button>
        </div>

      </div>
    </div>
  </teleport>
</template>
