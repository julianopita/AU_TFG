 function toggleContent(elementId, caretId) {
      const content = document.getElementById(elementId);
      content.style.display = content.style.display === 'flex' ? 'none' : 'flex';
      const caret = document.getElementById(caretId);
      caret.classList.toggle("rotated");
    } 