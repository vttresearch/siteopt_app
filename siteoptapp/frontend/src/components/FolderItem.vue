<script setup>
import { ref } from 'vue';
import {FontAwesomeIcon} from "@fortawesome/vue-fontawesome";
import FileItem from "@/components/FileItem.vue";


const props = defineProps ({
  folderName: String,
  children: Array,
})

const isOpen = ref(true)

function toggle() {
  isOpen.value = !isOpen.value
}
</script>

<template>
  <div class="py-0.5 cursor-pointer">
    <span class="font-bold" @click="toggle" v-if="isOpen"><font-awesome-icon class="pr-1" icon="fa-regular fa-folder-closed" fixed-width />{{ folderName }}</span>
    <span class="font-bold" @click="toggle" v-else><font-awesome-icon class="pr-1" icon="fa-regular fa-folder-open" fixed-width />{{ folderName }}</span>
    <div class="pt-0.5" v-if="!isOpen">
      <template v-for="child in children">
        <FileItem :item_name="child.name" :parent_name="folderName" />
      </template>
    </div>
  </div>
</template>
