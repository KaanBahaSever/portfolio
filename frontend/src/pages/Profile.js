import PostList from "../components/PostList";
import { useParams } from 'react-router';
import React from "react";
import axios from "axios";
import Post from "../components/Post";
import AvatarOverlay from "../components/AvatarOverlay";
import NavBar from "../components/NavBar";
import { Input } from 'antd';
import { useAuth } from "../auth/AuthProvider";
import NavBarMobile from "../components/NavBarMobile";
import { Skeleton } from "antd";
import '../App.css';

const { Search } = Input;

export default function Profile() {
    const { id } = useParams()
    const [data, setPost] = React.useState(null);
    const [nowUser, setNowUser] = React.useState({ "avatar": "" });
    const [isLoaded, setIsLoaded] = React.useState(false);
    const [isLoadedText, setIsLoadedText] = React.useState(false);
    const [isSelfLook, setIsSelfLook] = React.useState(false);

    const auth = useAuth();
    const user = auth.user;

    React.useEffect(() => {
        //Kullanıcı giriş yapmış ve kendi profiline bakıyor
        //Kullanıcı giriş yapmış ve başka bir kullanıcının profiline bakıyor
        //Kullanıcı giriş yapmamış ve başka bir kullanıcının profiline bakıyor
        if (user && user.id == id) setIsSelfLook(true);

        axios.get("/api/get_user_posts/" + id).then((response) => {
            setPost(response.data.posts);
            setNowUser(response.data.user);
            setIsLoaded(true);
        });
    });
    
    const onLoad = () => {
        setIsLoaded(true);
    }

    return (
        <div className="home-container">
            <NavBar />

            <div className="home">
                <div className="feed-container">
                    <div className="profile-container">
                        {
                            (user) ?
                                (id == user.id) ? (
                                    <AvatarOverlay src={user.avatar} />
                                ) : (
                                    (isLoaded) ? (
                                        <img src={nowUser.avatar} onLoad={onLoad} alt="selam" />
                                    ) : (
                                        <Skeleton.Avatar active />
                                    )
                                ) :
                                (
                                    (isLoaded) ? (
                                        <img src={nowUser.avatar} onLoad={onLoad} alt="selam2" />
                                    ) : (
                                        <Skeleton.Avatar active />
                                    )
                                )
                        }

                        <div>
                            <div style={{ fontSize: "24px" }}>
                                {isLoadedText ? (
                                    `@${user && user.id == id ? user.username : nowUser.username}`
                                ) : (
                                    <Skeleton.Input style={{ width: 150 }} active />
                                )}
                            </div>
                            <div style={{ marginTop: "5px" }}>
                                Gönderi Sayısı: {data ? data.length : 0}
                            </div>
                        </div>
                    </div>

                    {data ? (
                        <PostList>
                            {data.map(item => (
                                <Post item={item} />
                            ))}
                        </PostList>
                    ) : (
                        <p>Loading...</p>
                    )}
                </div>
                <NavBarMobile />
            </div>
            <div className="menu">
                <div>
                    <Search placeholder="Bir şeyler ara" style={{ width: 250, margin: "18px" }} />
                </div>
            </div>
        </div>
    )
}