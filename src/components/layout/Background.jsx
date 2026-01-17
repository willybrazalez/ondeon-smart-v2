import React from 'react';

const Background = () => {
  return (
    <div className="absolute inset-0 -z-10">
      <svg
        className="w-full h-full"
        viewBox="0 0 1440 320"
        preserveAspectRatio="none"
      >
        <path
          fill="url(#ondeonGradient)"
          d="M0,192L60,176C120,160,240,128,360,144C480,160,600,224,720,250.7C840,277,960,267,1080,240C1200,213,1320,171,1380,149.3L1440,128L1440,320L1380,320C1320,320,1200,320,1080,320C960,320,840,320,720,320C600,320,480,320,360,320C240,320,120,320,60,320L0,320Z"
        ></path>
        <defs>
          <linearGradient id="ondeonGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0B1D3A" />
            <stop offset="50%" stopColor="#2C1E4A" />
            <stop offset="100%" stopColor="#2CC2B6" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
};

export default Background;