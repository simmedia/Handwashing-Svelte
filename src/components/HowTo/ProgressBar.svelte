<script>
  import { tweened } from "svelte/motion";
  export let progress = 0;

  const tweenedProgress = tweened(0);
  $: tweenedProgress.set(progress);
</script>

<style>
  .progress-container {
    margin: 20px 0;
    border: 1px solid #c5c5c5;
  }
  .progress-bar {
    height: 30px;
    background: #a0da4a;
  }
  .sr-only {
    line-height: 30px;
  }
</style>

<div bp="grid">
  <div bp="offset-5@md 4@md 12@sm" class="progress-container">
    <div style="width: {$tweenedProgress}%;" class="progress-bar">
      <span class="sr-only">{progress}%</span>
    </div>
  </div>
</div>
