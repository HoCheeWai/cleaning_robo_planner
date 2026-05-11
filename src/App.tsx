import { CalculatorProvider } from './state';
import { Header } from './components/Header/Header';
import { Footer } from './components/Footer/Footer';
import { InputForm } from './components/InputForm/InputForm';
import { ResultDisplay } from './components/ResultDisplay/ResultDisplay';
import './App.css';

function App() {
  return (
    <CalculatorProvider>
      <div className="app">
        <Header />
        <main className="main">
          <div className="inputPanel">
            <InputForm />
          </div>
          <div className="resultPanel">
            <ResultDisplay />
          </div>
        </main>
        <Footer />
      </div>
    </CalculatorProvider>
  );
}

export default App;
