<script setup>
import FileItem from "./FileItem.vue";
import FolderItem from "./FolderItem.vue";


const props = defineProps({
  title: String,
  model: Object
})

function isFolder(list_item) {
  return "children" in list_item
}
</script>

<template>
  <section>
    <div class="bg-white rounded-xl shadow-md relative p-2 text-xs">
      <div class="mb-4 text-gray-600 text-base"><span>{{ title }}</span></div>
      <ul>
        <template v-for="item in props.model">
          <li v-if="!isFolder(item)">
            <FileItem :item_name="item.name"/>
          </li>
          <li v-else>
            <FolderItem :folderName="item.name" :children="item.children" />
          </li>
        </template>
      </ul>
    </div>
  </section>
</template>
