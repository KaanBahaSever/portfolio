import { NavLink } from "react-router-dom";
import { RxAvatar } from "react-icons/rx";
import { IoHomeOutline } from "react-icons/io5";
import { CiLogin } from "react-icons/ci";
import { AiOutlineForm } from "react-icons/ai";
import { IoCreateOutline } from "react-icons/io5";
import { useAuth } from "../auth/AuthProvider";

import '../NavBarMobile.css';

export default function NavBarMobile() {
    const auth = useAuth();
    const user = auth.user;

    const handleClick = () => {
        window.scrollTo(0, 0)
    }

    return (
        <div className="navbar-mobile">
            {
                user ? (
                    <nav className="navbar-mobile">
                        <NavLink to={'/social'} end="true">
                            <IoHomeOutline size={"25px"} />
                        </NavLink >
                        <NavLink to={'/social/profile/' + user.id} end="true">
                            <RxAvatar size={"25px"} />
                        </NavLink >
                        <a onClick={handleClick}>
                            <IoCreateOutline size={"25px"} />
                        </a>
                    </nav>
                ) : (
                    <nav className="navbar-mobile">
                        <NavLink to={'/social'} end="true">
                            <IoHomeOutline size={"25px"} />
                        </NavLink >
                        <NavLink to={'/social/register'} end="true">
                            <AiOutlineForm size={"25px"} />
                        </NavLink >
                        <NavLink to={'/social/login'} end="true">
                            <CiLogin size={"30px"} />
                        </NavLink >
                    </nav>
                )
            }
        </div >
    )
}