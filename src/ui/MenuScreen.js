/**
 * MenuScreen - Handles title, game over, and victory screens
 */
export class MenuScreen {
  constructor() {
    this.titleScreen = document.getElementById('title-screen');
    this.gameoverScreen = document.getElementById('gameover-screen');
    this.victoryScreen = document.getElementById('victory-screen');
    this.hud = document.getElementById('hud');
    this.pointerPrompt = document.getElementById('pointer-lock-prompt');

    this.startButton = document.getElementById('start-button');
    this.retryButton = document.getElementById('retry-button');
    this.victoryRetryButton = document.getElementById('victory-retry-button');

    this.onStart = null;
    this.onRetry = null;

    this._setupListeners();
  }

  _setupListeners() {
    this.startButton.addEventListener('click', () => {
      if (this.onStart) this.onStart();
    });

    this.retryButton.addEventListener('click', () => {
      if (this.onRetry) this.onRetry();
    });

    this.victoryRetryButton.addEventListener('click', () => {
      if (this.onRetry) this.onRetry();
    });
  }

  showTitle() {
    this.titleScreen.classList.remove('hidden');
    this.titleScreen.classList.add('active');
    this.gameoverScreen.classList.add('hidden');
    this.victoryScreen.classList.add('hidden');
    this.hud.classList.add('hidden');
  }

  showGame() {
    this.titleScreen.classList.add('hidden');
    this.gameoverScreen.classList.add('hidden');
    this.victoryScreen.classList.add('hidden');
    this.hud.classList.remove('hidden');
  }

  showGameOver() {
    this.gameoverScreen.classList.remove('hidden');
    this.hud.classList.add('hidden');
  }

  showVictory() {
    this.victoryScreen.classList.remove('hidden');
    this.hud.classList.add('hidden');
  }

  showPointerPrompt() {
    this.pointerPrompt.classList.remove('hidden');
  }

  hidePointerPrompt() {
    this.pointerPrompt.classList.add('hidden');
  }
}
