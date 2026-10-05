import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

const Landing: React.FC = () => {
  const [textEffect, setTextEffect] = useState('');
  const fullText = "> SYSTEM.INIT(BALANCE_ENGINE) ...";

  useEffect(() => {
    let index = 0;
    const interval = setInterval(() => {
      setTextEffect(fullText.slice(0, index));
      index++;
      if (index > fullText.length) {
        clearInterval(interval);
      }
    }, 100);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="cassette-theme min-h-[100dvh] flex flex-col relative overflow-hidden">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=VT323&display=swap');
        
        :root {
          --crt-green-cassette: #33FF00;
          --phosphor-amber-cassette: #FFB000;
          --charcoal-cassette: #333333;
          --deep-navy-cassette: #1B2838;
          --tape-red-cassette: #CC0000;
          --warm-beige-cassette: #D2B48C;
          --scanline-gap: 4px;
          --font-cassette: 'VT323', monospace;
        }

        .cassette-theme {
          background: var(--deep-navy-cassette);
          color: var(--crt-green-cassette);
          font-family: var(--font-cassette);
        }

        .cassette-theme * {
          font-family: var(--font-cassette);
        }

        .scanlines {
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          background-image: repeating-linear-gradient(
            0deg,
            transparent,
            transparent 2px,
            rgba(0,0,0,0.15) 2px,
            rgba(0,0,0,0.15) 4px
          );
          pointer-events: none;
          z-index: 200;
        }

        .vhs-distortion {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
          z-index: 150;
          animation: vhs-flicker 0.1s linear infinite, vhs-tracking 10s linear infinite;
          background: rgba(51, 255, 0, 0.02);
        }

        @keyframes vhs-flicker {
          0% { opacity: 0.95; }
          100% { opacity: 1; }
        }

        @keyframes vhs-tracking {
          0% { transform: translateY(-100%); opacity: 0.5; }
          5% { transform: translateY(100%); opacity: 0; }
          100% { transform: translateY(100%); opacity: 0; }
        }

        .phosphor-glow {
          text-shadow: 0 0 5px var(--crt-green-cassette), 0 0 10px rgba(51, 255, 0, 0.5);
        }
        
        .phosphor-glow-amber {
          text-shadow: 0 0 5px var(--phosphor-amber-cassette), 0 0 10px rgba(255, 176, 0, 0.5);
          color: var(--phosphor-amber-cassette);
        }

        .chunky-border {
          border: 3px solid var(--crt-green-cassette);
          box-shadow: 0 0 15px rgba(51, 255, 0, 0.3), inset 0 0 10px rgba(51, 255, 0, 0.2);
          background: rgba(27, 40, 56, 0.8);
          transition: all 0.2s ease;
        }

        .chunky-border:hover {
          background: var(--crt-green-cassette);
          color: var(--deep-navy-cassette);
          box-shadow: 0 0 25px rgba(51, 255, 0, 0.5);
        }

        .chunky-border-amber {
          border: 3px solid var(--phosphor-amber-cassette);
          box-shadow: 0 0 15px rgba(255, 176, 0, 0.3), inset 0 0 10px rgba(255, 176, 0, 0.2);
          background: rgba(27, 40, 56, 0.8);
          color: var(--phosphor-amber-cassette);
        }

        .chunky-border-amber:hover {
          background: var(--phosphor-amber-cassette);
          color: var(--deep-navy-cassette);
          box-shadow: 0 0 25px rgba(255, 176, 0, 0.5);
        }

        .tape-reel {
          width: 80px;
          height: 80px;
          border: 4px solid var(--crt-green-cassette);
          border-radius: 50%;
          position: relative;
          animation: spin 4s linear infinite;
          box-shadow: 0 0 15px rgba(51, 255, 0, 0.3);
        }
        
        .tape-reel::before, .tape-reel::after {
          content: '';
          position: absolute;
          background: var(--crt-green-cassette);
          box-shadow: 0 0 10px rgba(51, 255, 0, 0.5);
        }

        .tape-reel::before {
          top: 50%; left: 10%; right: 10%; height: 4px;
          transform: translateY(-50%);
        }

        .tape-reel::after {
          left: 50%; top: 10%; bottom: 10%; width: 4px;
          transform: translateX(-50%);
        }

        @keyframes spin {
          100% { transform: rotate(360deg); }
        }

        .blink-cursor {
          animation: blink 1s step-end infinite;
        }

        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
          
        .meter-gauge {
          width: 100%;
          height: 12px;
          background: var(--charcoal-cassette);
          border: 2px solid var(--crt-green-cassette);
          margin-top: 10px;
          position: relative;
        }

        .meter-fill {
          height: 100%;
          background: var(--crt-green-cassette);
          animation: meter-bounce 2s ease-in-out infinite alternate;
        }
          
        .meter-fill.amber {
          background: var(--phosphor-amber-cassette);
          animation: meter-bounce-amber 3s ease-in-out infinite alternate;
        }

        @keyframes meter-bounce {
          0% { width: 30%; }
          100% { width: 80%; }
        }
        
        @keyframes meter-bounce-amber {
          0% { width: 50%; }
          100% { width: 95%; }
        }
          
        .bg-crt-green { background-color: var(--crt-green-cassette); }
        .text-crt-green { color: var(--crt-green-cassette); }
        .border-crt-green { border-color: var(--crt-green-cassette); }
        
        .nav-link {
          position: relative;
          text-transform: uppercase;
          transition: all 0.2s;
        }
        
        .nav-link:hover {
          color: var(--phosphor-amber-cassette);
          text-shadow: 0 0 8px rgba(255, 176, 0, 0.6);
        }
        
        .nav-link:hover::before {
          content: '>';
          position: absolute;
          left: -15px;
          color: var(--phosphor-amber-cassette);
        }
      `}</style>

      {/* Effects */}
      <div className="scanlines"></div>
      <div className="vhs-distortion"></div>

      {/* Navbar */}
      <header className="flex justify-between items-center p-6 border-b-[3px] border-crt-green bg-[#1B2838] z-50">
        <div className="flex items-center gap-4">
          <div className="tape-reel !w-10 !h-10 border-[3px]"></div>
          <h1 className="text-3xl font-bold phosphor-glow uppercase tracking-widest">
            Balance_Engine
          </h1>
        </div>
        <nav className="hidden md:flex gap-8 text-xl">
          <a href="#features" className="nav-link cursor-pointer">Features</a>
          <a href="#testimonials" className="nav-link cursor-pointer">Logs</a>
          <a href="#pricing" className="nav-link cursor-pointer">Access_Tiers</a>
        </nav>
        <div className="flex items-center gap-4">
          <Link to="/login" className="chunky-border px-6 py-2 text-xl font-bold uppercase cursor-pointer">
            Login
          </Link>
          <Link to="/register" className="chunky-border-amber px-6 py-2 text-xl font-bold uppercase cursor-pointer">
            Register
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col md:flex-row items-center justify-between p-8 md:p-16 z-40 gap-12">
        <div className="flex-1 space-y-8">
          <div className="inline-block px-4 py-1 border-2 border-[#FFB000] text-[#FFB000] mb-4 text-lg">
            SYS_STATUS: ONLINE
          </div>
          <h2 className="text-5xl md:text-7xl font-bold uppercase leading-tight phosphor-glow">
            Analog Control <br/> For Digital Wealth
          </h2>
          <p className="text-2xl text-[#D2B48C] max-w-2xl h-8 md:h-16">
            {textEffect}<span className="blink-cursor">_</span>
          </p>
          <p className="text-xl text-[#999999] max-w-2xl">
            The future wasn't sleek. It was engineered. Experience financial tracking with tactile feedback, scanlines, and real consequence. No touchscreens. Just command.
          </p>
          <div className="flex flex-col sm:flex-row gap-6 pt-4">
            <Link to="/register" className="chunky-border px-8 py-4 text-2xl font-bold uppercase text-center cursor-pointer">
              Initialize_System
            </Link>
            <a href="#features" className="chunky-border px-8 py-4 text-2xl font-bold uppercase text-center cursor-pointer !bg-transparent hover:!bg-[#33FF00] hover:!text-[#1B2838]">
              Read_Docs
            </a>
          </div>
        </div>
        <div className="flex-1 flex justify-center items-center relative min-h-[300px] md:min-h-[400px]">
          <div className="absolute w-[250px] h-[250px] md:w-[300px] md:h-[300px] border-4 border-dashed border-[#FFB000] rounded-full animate-[spin_10s_linear_infinite] opacity-30"></div>
          <div className="absolute w-[150px] h-[150px] md:w-[200px] md:h-[200px] border-4 border-[#33FF00] rounded-full animate-[spin_5s_linear_infinite_reverse] opacity-50"></div>
          <div className="tape-reel !w-[100px] !h-[100px] md:!w-[150px] md:!h-[150px] !border-[6px] !bg-[#1B2838]"></div>
          <div className="absolute -bottom-12 md:-bottom-8 bg-[#333333] border-2 border-[#33FF00] p-4 text-xl flex flex-col items-center">
            <span>DATA_STREAM</span>
            <div className="meter-gauge !w-48"><div className="meter-fill"></div></div>
          </div>
        </div>
      </main>

      {/* Features Section */}
      <section id="features" className="p-8 md:p-16 border-t-[3px] border-crt-green bg-[#111A24] z-40 mt-16 md:mt-0">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold phosphor-glow-amber mb-4">{'>'} DIR /FEATURES</h2>
          <div className="meter-gauge !w-64 mx-auto"><div className="meter-fill amber"></div></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { title: "Tactile Input", icon: "M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122", desc: "Mechanical feedback for every transaction. Feel the weight of your financial decisions." },
            { title: "CRT Analytics", icon: "M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z", desc: "Data visualization powered by pure phosphor glow. No flat UI, just scanlines and raw data." },
            { title: "Magnetic Backup", icon: "M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4", desc: "Your ledger is redundantly stored on virtual magnetic tape. Immutable and secure." }
          ].map((f, i) => (
            <div key={i} className="border-[3px] border-crt-green p-8 bg-[#1B2838] hover:-translate-y-2 transition-transform cursor-pointer relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-2 text-sm text-[#FFB000] border-l-2 border-b-2 border-[#FFB000] bg-[#333333]">
                SEC_0{i+1}
              </div>
              <svg className="w-16 h-16 mb-6 text-[#FFB000]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="square" strokeLinejoin="miter" d={f.icon} />
              </svg>
              <h3 className="text-2xl font-bold mb-4 uppercase text-[#D2B48C]">{f.title}</h3>
              <p className="text-xl text-[#999999]">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="p-8 md:p-16 border-t-[3px] border-crt-green bg-[#1B2838] z-40">
        <h2 className="text-4xl font-bold phosphor-glow mb-12 uppercase">{'>'} READ_LOGS --USER</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { text: "Finally, an interface I can punch. The amber warnings make my overspending feel like a critical reactor failure.", user: "RIPLEY_8" },
            { text: "The scanlines help me focus. It's like computing before we decided everything needed to be smooth and boring.", user: "GIBSON_HACKER" },
            { text: "I threw away my modern budgeting app. Balance Engine makes managing money feel like piloting a 1980s spacecraft.", user: "TAPE_DECK_USER" }
          ].map((t, i) => (
            <div key={i} className="border-2 border-dashed border-[#999999] p-6 relative">
              <div className="absolute -top-3 left-4 bg-[#1B2838] px-2 text-[#FFB000]">LOG_ENTRY_{1024 + i}</div>
              <p className="text-xl text-[#D2B48C] mb-6">"{t.text}"</p>
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 border-2 border-crt-green flex items-center justify-center bg-[#333333]">
                  {i+1}
                </div>
                <span className="text-lg uppercase text-crt-green">USR: {t.user}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="p-8 md:p-16 border-t-[3px] border-crt-green bg-[#111A24] z-40">
        <h2 className="text-4xl font-bold phosphor-glow-amber mb-12 text-center">{'>'} EXECUTE ACCESS_TIERS.EXE</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {[
            { name: "FLOPPY", price: "0", desc: "Basic command line access.", color: "crt-green" },
            { name: "CASSETTE", price: "12", desc: "Full magnetic tape features.", color: "amber", active: true },
            { name: "MAINFRAME", price: "49", desc: "Direct neural link required.", color: "crt-green" }
          ].map((p, i) => (
            <div key={i} className={`border-[3px] p-8 flex flex-col ${p.active ? 'border-[#FFB000] md:scale-105 bg-[#253646] shadow-[0_0_20px_rgba(255,176,0,0.2)]' : 'border-crt-green bg-[#1B2838]'} relative`} style={{ zIndex: p.active ? 10 : 1 }}>
              {p.active && <div className="text-center mb-4 bg-[#FFB000] text-[#1B2838] font-bold py-1">RECOMMENDED_MODULE</div>}
              <h3 className={`text-3xl font-bold mb-2 uppercase ${p.active ? 'text-[#FFB000]' : 'text-crt-green'}`}>{p.name}</h3>
              <div className="text-5xl font-bold mb-6 text-[#D2B48C]">${p.price}<span className="text-2xl text-[#999999]">/MO</span></div>
              <p className="text-xl text-[#999999] mb-8 flex-1">{p.desc}</p>
              <Link to="/register" className={`text-center py-4 text-xl font-bold uppercase border-2 cursor-pointer transition-all ${p.active ? 'bg-[#FFB000] text-[#1B2838] border-[#FFB000] hover:bg-transparent hover:text-[#FFB000]' : 'border-crt-green text-crt-green hover:bg-crt-green hover:text-[#1B2838]'}`}>
                ALLOCATE_FUNDS
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="p-16 text-center border-t-[3px] border-crt-green bg-[#1B2838] z-40 relative">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPgo8cmVjdCB3aWR0aD0iOCIgaGVpZ2h0PSI4IiBmaWxsPSIjMUIyODM4Ij48L3JlY3Q+CjxwYXRoIGQ9Ik0wIDBMOCA4Wk04IDBMMCA4WiIgc3Ryb2tlPSIjMzMzMzMzIiBzdHJva2Utd2lkdGg9IjEiPjwvcGF0aD4KPC9zdmc+')] opacity-20"></div>
        <div className="relative z-10">
          <h2 className="text-4xl md:text-5xl font-bold phosphor-glow mb-8 uppercase">SYSTEM READY FOR INPUT</h2>
          <Link to="/register" className="inline-block chunky-border px-8 py-4 md:px-12 md:py-6 text-2xl md:text-3xl font-bold uppercase">
            BEGIN_SEQUENCE
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t-4 border-[#FFB000] bg-[#111A24] p-8 md:p-12 z-40 relative">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-6 h-6 border-2 border-[#FFB000] bg-[#CC0000]"></div>
              <span className="text-2xl font-bold text-[#FFB000] uppercase">Balance_Engine</span>
            </div>
            <p className="text-lg text-[#999999] max-w-sm">
              Cassette futurism analog financial control system. Built for resilience, not convenience.
            </p>
          </div>
          <div>
            <h4 className="text-xl font-bold mb-4 text-[#D2B48C] uppercase border-b border-[#333333] pb-2">Links</h4>
            <ul className="space-y-2 text-lg text-[#999999]">
              <li><Link to="/dashboard" className="hover:text-crt-green uppercase cursor-pointer">{'>'} Dashboard</Link></li>
              <li><Link to="/login" className="hover:text-crt-green uppercase cursor-pointer">{'>'} Authenticate</Link></li>
              <li><a href="#features" className="hover:text-crt-green uppercase cursor-pointer">{'>'} Specs</a></li>
            </ul>
          </div>
          <div>
            <h4 className="text-xl font-bold mb-4 text-[#D2B48C] uppercase border-b border-[#333333] pb-2">Legal</h4>
            <ul className="space-y-2 text-lg text-[#999999]">
              <li><a href="#" className="hover:text-crt-green uppercase cursor-pointer">{'>'} Privacy_Policy</a></li>
              <li><a href="#" className="hover:text-crt-green uppercase cursor-pointer">{'>'} Terms_Of_Use</a></li>
              <li><a href="#" className="hover:text-crt-green uppercase cursor-pointer">{'>'} Contact_Node</a></li>
            </ul>
          </div>
        </div>
        <div className="border-t-2 border-[#333333] pt-8 flex flex-col md:flex-row justify-between items-center text-lg text-[#999999]">
          <p>© 2026 Balance Engine. All systems operational.</p>
          <div className="flex gap-4 mt-4 md:mt-0">
            <a href="#" className="w-10 h-10 border-2 border-[#999999] flex items-center justify-center hover:border-crt-green hover:text-crt-green cursor-pointer">TW</a>
            <a href="#" className="w-10 h-10 border-2 border-[#999999] flex items-center justify-center hover:border-crt-green hover:text-crt-green cursor-pointer">GH</a>
            <a href="#" className="w-10 h-10 border-2 border-[#999999] flex items-center justify-center hover:border-crt-green hover:text-crt-green cursor-pointer">LI</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
