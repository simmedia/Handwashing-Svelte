<script>
  import Button from "../../UI/Button.svelte";
  import ProgressBar from "./ProgressBar.svelte";

  const totalSeconds = 20;
  let secondsLeft = totalSeconds;
  let isRunning = false;
  let stoped = false;

  $: progress = Math.round(((totalSeconds - secondsLeft) / totalSeconds) * 100)


  function startTimer() {
    stoped = false;
    isRunning = true;
    const timer = setInterval(() => {
      secondsLeft -= 1;
      if (secondsLeft == 0 || stoped) {
        clearInterval(timer);
        isRunning = false;
        secondsLeft = totalSeconds;
      }
    }, 1000);
  }
</script>

<style>
  h2 {
    margin: 0;
  }
  .btns {
    width: 600px;
    margin: 0 auto;
    text-align: center;
  }
</style>

<div class="container">
<div bp="grid">
  <h2 bp="offset-5@md 4@md 12@sm">Seconds Left: {secondsLeft}</h2>
</div>

<ProgressBar {progress} />

<div class="btns">
 <Button disabled={isRunning} on:click={() => startTimer()} color="red">
  Start
</Button>
<Button disabled={!isRunning} on:click={() => (stoped = true)}>Restart</Button>

</div>
</div>