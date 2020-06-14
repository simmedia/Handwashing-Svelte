<script>
  //   import { onMount } from "svelte";
  let activeLink = 0;
  export let color = ''
  export let bottomNavLinks = [];

  $: index = 0;

  $: lineStyle = () => {
    return `
      width: ${100 / bottomNavLinks.length}%; 
      transform: translateX(${index}%);
      background: ${color};
      `;
  };

  //   onMount(()=> {
  //   });

  const changeTab = (i, w) => {
    index = i * 100;
    activeLink = i;
  };
</script>

<style>
  .bottom-nav {
    position: fixed;
    bottom: 0;
    width: 100%;
    display: none;
  }

  .wrapper {
    position: relative;
    display: flex;
    justify-content: center;
    height: 80px;
    padding: 0;
    background: #ffffff;
  }

  button {
    position: relative;
    height: 100%;
    border: none;
    border-radius: 0px;
    flex: 1;
    margin: 0;
    padding-top: 10px;
    background: #ffffff;
    color: #c5c5c5;
    display: flex;
    flex-direction: column;
    justify-content: space-evenly;
    transition: 0.4s ease-in-out;
  }

  .active {
    color: var(--prime);
    background-color: #e6e6e66b;
  }

  #underline {
    position: absolute;
    bottom: 0;
    height: 4px;
    z-index: 222;
    transition: 0.4s ease-in-out;
  }

  @media screen and (max-width: 600px) {
    .bottom-nav {
      display: block;
    }
  }
</style>

<div class="bottom-nav">
  <div class="wrapper">
    {#each bottomNavLinks as link, i}
      <button
        class="tab"
        class:active={activeLink === i}
        on:click={e => changeTab(i, e.target.clientWidth)}>
        {@html link.icon}
        <span>{link.name}</span>
      </button>
    {/each}
  </div>
  <div style={lineStyle()} id="underline" />
</div>
