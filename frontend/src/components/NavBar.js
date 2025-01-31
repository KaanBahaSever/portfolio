import { NavLink } from "react-router-dom";
import { RxAvatar } from "react-icons/rx";
import { IoHomeOutline } from "react-icons/io5";
import { CiLogin } from "react-icons/ci";
import { AiOutlineForm } from "react-icons/ai";
import { useAuth } from "../auth/AuthProvider";
import { CiLogout } from "react-icons/ci";

import '../App.css';

export default function NavBar() {
    const auth = useAuth();
    const user = auth.user || JSON.parse(localStorage.getItem('user'));

    if (user) {
        localStorage.setItem('user', JSON.stringify(user));
    } else {
        localStorage.removeItem('user');
    }

    return (
        <div>
            {
                user ? (
                    <nav className="menu">
                        <NavLink className="menu-item" to={'/social'} end="true">
                            <IoHomeOutline size={"25px"} /> Ana Sayfa
                        </NavLink >
                        <NavLink className="menu-item" to={'/social/profile/' + user.id} end="true">
                            <RxAvatar size={"25px"} /> Profil
                        </NavLink >
                        {/* <NavLink className="menu-item">
                            <CiLogout size={"25px"} /> Çıkış Yap
                        </NavLink> */}
                    </nav>
                ) : (
                    <nav className="menu">
                         <NavLink className="menu-item" to={'/social'} end="true">
                            <IoHomeOutline size={"25px"} /> Ana Sayfa
                        </NavLink >
                        <NavLink className="menu-item" to={'/social/register'} end="true">
                            <AiOutlineForm size={"25px"} /> Kayıt ol
                        </NavLink >
                        <NavLink className="menu-item" to={'/social/login'} end="true">
                            <CiLogin size={"30px"} /> Giriş Yap
                        </NavLink >
                    </nav>
                )
            }
        </div>
    )
}