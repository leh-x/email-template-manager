//TODO: Change order of navigation to Email > Templates > signature
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navigation from './components/Navigation/Navigation';
import SignaturesView from './views/SignatureView/SignaturesView';
import EmailCompilerView from './views/EmailCompilerView';
import { ToastProvider } from './ui/toast';
import './ui/theme/theme.module.css';

function App() {
  return (
    <ToastProvider>
      <Router> 
          <Navigation />
              <Routes>
                  <Route path="/" element={<EmailCompilerView />} />
                  <Route path="/signatures" element={<SignaturesView />} />
              </Routes>
      </Router>
    </ToastProvider>
  );
}

export default App;