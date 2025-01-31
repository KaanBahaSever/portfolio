
import React from "react";
import axios from "axios";
import { useAuth } from "../auth/AuthProvider";

export default function Logut() {
    const { logOut } = useAuth();
    React.useEffect(() => {
        logOut();
    }, [])

    return (
        <div></div>
    )
}