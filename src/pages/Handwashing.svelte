<script>
import Timer from '../components/HowTo/Timer.svelte'

</script>

<style>
  h1 {
      text-align: center;
      margin-bottom: 50px;
  }
  img {
    margin: 0 auto;
    max-width: 100%;
  }
</style>

<h1>Handwashing Timer</h1>

<Timer />

<div bp="margin-top--lg grid">
  <img bp="offset-5@md 4@md 12@sm" src="images/handwashImage.gif" alt="How to wash your hands.">
</div>


<div bp="margin-top--lg">
  <a href="https://www.who.int/gpsc/clean_hands_protection/en/">Picture source</a>
</div>