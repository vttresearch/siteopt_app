<script setup>
import { useTableDataStore } from "@/stores/filedatastore.js";
import Table from "@/components/Table.vue";

const data_store = useTableDataStore()

</script>

<template>
  <div class="bg-white rounded-xl shadow-md relative">
    <div class="p-4">
      <div class="mb-6">
        <div class="text-gray-600 my-2">{{ data_store.fname }}</div>
      </div>
      <div class="mb-5">
          <div><Table /></div>
      </div>
      <div class="border border-gray-100 mb-5"></div>
    </div>
  </div>
</template>
