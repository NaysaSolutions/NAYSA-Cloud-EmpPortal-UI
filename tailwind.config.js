// tailwind.config.js
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sfProRounded: ['SF Pro Rounded', 'sans-serif'],
      },
      animation: {
        gradient: 'gradient 4s ease infinite', // Define the animation
      },
      keyframes: {
        gradient: {
          '0%': {
            backgroundPosition: '0% 50%',
          },
          '50%': {
            backgroundPosition: '100% 50%',
          },
          '100%': {
            backgroundPosition: '0% 50%',
          },
        },
      },
      colors: {
         'gradient-start': '#ff7e5f',  // Gradient 1 start color
        'gradient-end': '#feb47b',    // Gradient 1 end color
        'gradient-start-2': '#6a11cb', // Gradient 2 start color
        'gradient-end-2': '#2575fc',   // Gradient 2 end color
        'gradient-start-3': '#f12711', // Gradient 3 start color
        'gradient-end-3': '#f5af19',   // Gradient 3 end color
      },
      zIndex: {
        'modal': '9999',
        'swal': '10050',
      },
    },
  },
  plugins: [],


};
