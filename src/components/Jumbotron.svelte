<script>
</script>

<style>
  .container {
    margin: 0 auto;
    display: flex;
    flex-wrap: wrap;
    height: 80vh;
  }

  .container div {
    display: flex;
    flex-direction: column;
    justify-content: center;
    flex: 1;
    min-width: 400px;
  }
  .jumbotron {
    padding-left: 100px;
    height: 100%;
  }

  .jumbotron p {
    width: 70%;
    margin-top: 50px;
    font-size: 1.2rem;
    line-height: 24px;
  }

  @media screen and (max-width: 700px) {
    .container {
      padding: 10px;
      flex-direction: column;
      width: 90% !important;
    }
    .container div {
        min-width: 0px !important;
    }
    .container .jumbotron {
      width: 100% !important;
      padding-left: 0px !important;
      text-align: center;
      margin: 0 auto;
    }
    .jumbotron p {
      width: 100% !important;
      margin-top: 50px;
    }
    h1 {
        text-align: center;
        width: 100% !important;
        font-size: 1.8rem;
    }
    .image {
        width: 100%;
    }
    img {
        width: 100% !important;
    }
  }
</style>

<div class="container">
  <div class="jumbotron">
    <h1>Hello there people!</h1>
    <p>
      Lorem ipsum dolor sit amet consectetur adipisicing elit. Quam saepe
      adipisci rerum consequatur enim tempora ipsa dolor eum vero illo?
    </p>
  </div>

  <div class="image">
    <img width="100%" src="./images/home-image.jpg" alt="" />
  </div>
</div>
