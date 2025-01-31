import { BrowserRouter, Routes, Route } from "react-router-dom";
import React from "react";
import Home from "./pages/Home";
import Profile from "./pages/Profile";
import Register from "./pages/Register"
import Login from "./pages/Login"
import NoPage from "./pages/NoPage";
import AuthProvider from "./auth/AuthProvider"
import Logout from "./components/Logout"
import { CookiesProvider } from 'react-cookie';

import './App.css';

function App() {
  return (
    <BrowserRouter>
      <CookiesProvider defaultSetOptions={{ path: '/' }}>
        <AuthProvider>
          <Routes>
            <Route path="social">
              <Route index element={<Home />} />
              <Route path="profile/:id?" element={<Profile />} />
              <Route path="register" element={<Register />} />
              <Route path="login" element={<Login />} />
              <Route path="logout" element={<Logout />} />
              <Route path="*" element={<NoPage />} />
            </Route>
          </Routes>
        </AuthProvider>
      </CookiesProvider>
    </BrowserRouter>
  );
}

export default App;
