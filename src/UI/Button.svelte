<script>
  // your script goes here
  export let mode = "";
  export let color = "";
  export let disabled = false;
</script>

<style>
  /* your styles go here */
  button {
    outline: none;
    border: none;
    padding: 10px;
    cursor: pointer;
  }
  button:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }
  .red {
    background: #e28080;
    color: #fff;
  }
  .blue {
    background: #6f6fec;
    color: #fff;
  }
</style>

<button {disabled} on:click class={color}>
  <slot />
</button>
