<script setup>
import { ref } from 'vue';
import Cell from './Cell.vue'
import { cells } from '@/stores/examplestore.js';

const cols = cells.map((_, i) => String.fromCharCode(65 + i))
const somedata = ref(
    [[1, 2], [3, 4], [5, 6]])

</script>

<template>
  <table>
    <thead>
      <tr>
        <th></th>
        <th v-for="c in cols">{{ c }}</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="i in cells[0].length">
        <th>{{ i - 1 }}</th>
        <td v-for="(c, j) in cols">
          <Cell :r="i - 1" :c="j"></Cell>
        </td>
      </tr>
    </tbody>
  </table>

  <table>
    <thead>
      <tr>
        <th></th>
        <th v-for="c in somedata">{{ c }}</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="i in somedata[0].length">
        <th>{{ i - 1 }}</th>
        <td v-for="(c, j) in somedata">
          <Cell :r="i - 1" :c="j" :arvo="somedata[i-1][j]"></Cell>
        </td>
      </tr>
    </tbody>
  </table>
</template>

<style>
body {
  margin: 0;
}

table {
  border-collapse: collapse;
  table-layout: fixed;
  width: 100%;
}

th {
  background-color: #eee;
}

tr:first-of-type th {
  width: 100px;
}

tr:first-of-type th:first-of-type {
  width: 25px;
}

td {
  border: 1px solid #ccc;
  height: 1.5em;
  overflow: hidden;
}
</style>