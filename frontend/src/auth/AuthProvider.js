import { useContext, createContext, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

const AuthContext = createContext();

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null); //{ id:1, username: "kaan" }
  const navigate = useNavigate();
  const loginAction = async (data) => {
    try {
      const response = await axios.post("/auth/login", data, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });
      const res = await response.data;
      if (res.success) {
        document.querySelector(".error-login").style.display = "none";
        setUser(res.user);
        navigate("/social");
        return;
      }

      document.querySelector(".error-login").style.display = "block";
      throw new Error("Username or Password Invalid");
    } catch (err) {
      console.error(err);
    }
  };

  const logOut = () => {
    axios.get("/auth/logout").then((res) => {
      if (res.status) {
        setUser(null);
        navigate("/social");
      }
    });
  };

  useEffect(() => {
    axios.get("/auth/current_user").then((res) => {
      if (res.status) {
        setUser(res.data.user);
      }
    });
  }, []);

  return (
    <AuthContext.Provider value={{ user, loginAction, logOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;

export const useAuth = () => {
  return useContext(AuthContext);
};