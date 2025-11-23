// Brands dropdown functionality
document.addEventListener('DOMContentLoaded', () => {
  // Handle all brands dropdowns (header and sidebar)
  const brandsDropdowns = document.querySelectorAll('.brands-dropdown');
  const brandsLinks = document.querySelectorAll('[data-brand]');

  // Toggle dropdown on click for all dropdowns
  brandsDropdowns.forEach(dropdown => {
    const dropdownBtn = dropdown.querySelector('.brands-dropdown-btn');
    if (dropdownBtn) {
      dropdownBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        // Close all other dropdowns first
        brandsDropdowns.forEach(otherDropdown => {
          if (otherDropdown !== dropdown) {
            otherDropdown.classList.remove('active');
          }
        });
        
        // Toggle current dropdown
        dropdown.classList.toggle('active');
      });
    }
  });

  // Close dropdowns when clicking outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.brands-dropdown')) {
      brandsDropdowns.forEach(dropdown => {
        dropdown.classList.remove('active');
      });
    }
  });

  // Handle brand selection
  brandsLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const brand = link.getAttribute('data-brand');
      
      // Store selected brand in localStorage
      localStorage.setItem('selectedBrand', brand);
      
      // Redirect to category page with brand filter
      window.location.href = `/pages/category.html?brand=${brand}`;
    });
  });
  
  // Check if there's a brand in the URL and update the page title
  const urlParams = new URLSearchParams(window.location.search);
  const brandParam = urlParams.get('brand');
  if (brandParam) {
    // Find the brand name from the link
    const brandLink = Array.from(brandsLinks).find(link => link.getAttribute('data-brand') === brandParam);
    if (brandLink) {
      const brandName = brandLink.textContent.trim();
      // Update page title if on category page
      const categoryTitle = document.getElementById('category-title');
      if (categoryTitle) {
        categoryTitle.textContent = brandName;
      }
    }
  }
});