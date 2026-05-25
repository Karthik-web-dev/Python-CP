function startJourney(){
  const container = document.querySelector('.welcome-container');

  // Add slide-out class to trigger animation
  container.classList.add('slide-out');

  // Redirect to main page after animation completes
  setTimeout(() => {
    window.location.href = 'asep.html';
  }, 800); // Match the animation duration in CSS
}
