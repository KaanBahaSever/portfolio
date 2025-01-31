import PostList from "../components/PostList";
import React from "react";
import axios from "axios";
import Post from "../components/Post";
import NavBar from "../components/NavBar";
import { Link, useNavigate } from "react-router-dom";
import NavBarMobile from "../components/NavBarMobile";
import { UploadOutlined } from '@ant-design/icons';
import { Input, Button, Upload } from 'antd';
import { TbSocial } from "react-icons/tb";
import { CircularProgressbar, buildStyles } from 'react-circular-progressbar';
import { useAuth } from "../auth/AuthProvider";
import { ReactComponent as CyloneSVG } from "../icons/cylone.svg"
import '../App.css';

const { TextArea, Search } = Input;

export default function Home() {
    const [data, setPost] = React.useState(null);
    const [countText, setCountText] = React.useState(0);
    const [displayBar, setdisplayBar] = React.useState(false);
    const [body, setBody] = React.useState("");
    const auth = useAuth();
    const user = auth.user

    React.useEffect(() => {
        axios.get("/api/get_posts").then((response) => {
            if (response.status) {
                setPost(response.data.posts);
            }
        });
        document.getElementById("root").style.height = "unset";
    }, []);

    const handleClick = () => {
        if (body.length >= 2 && body.length <= 256) {
            axios.post("/api/publish_post", { "body": body }, {
                headers: {
                    'Content-Type': 'application/json'
                }
            }).then((response) => {
                if (response.data.success) {
                    const post = {
                        "body": body, elapsed: "Just Now",
                        "user": {
                            "id": user.id,
                            "username": user.username,
                            "avatar": user.avatar
                        }
                    };
                  
                    setPost((prev) => [post, ...prev]);
                    setBody("");
                }
            });
        }
    }

    const keyUp = (e) => {
        setBody(e.target.value);
        const value = e.target.value.length;
        console.log(value)
        setCountText(value)
        if (value === 0) {
            setdisplayBar(false);
        }
        else {
            setdisplayBar(true);
        }
    }
    return (
        <div className="home-container">
            <NavBar></NavBar>
            <div className="home">
                <div className="feed-container">
                    <div style={{ textAlign: "center", marginTop: "15px" }}>
                        <div>
                            <CyloneSVG className="main-icon" />
                        </div>
                        <div className='login-name'>
                            <div className="social-title">Bumerang</div>
                        </div>
                    </div>

                    {
                        (!user) ? (
                            <div>
                                <div style={{ textAlign: "center", marginTop: "10px", marginBottom: "20px" }}>
                                    Post Paylaşmak İçin Giriş Yapmalısınız
                                </div>
                                <div className="auth-buttons">
                                    <Link to={'/social/login'} end>
                                        <Button >Giriş Yap</Button>
                                    </Link>

                                    <Link to={'/social/register'} end>
                                        <Button type="primary">Kayıt Ol</Button>
                                    </Link>
                                </div>
                            </div>
                        ) : (
                            <div className="text-area-container">
                                <TextArea
                                    maxLength={256}
                                    placeholder="Aklından geçen bir şeyler var mı?"
                                    style={{ height: 100, resize: 'none', marginBottom: "12px", fontSize: "18px" }}
                                    value={body}
                                    onChange={keyUp}
                                />
                                <div className="submit-button">
                                    <div style={{ marginRight: "auto" }}>

                                        <Upload maxCount={1}>
                                            <Button icon={<UploadOutlined />}>Click to Upload</Button>
                                        </Upload>
                                    </div>
                                    <div style={{ display: displayBar ? 'flex' : 'none', width:"30px" }}>
                                        <CircularProgressbar minValue={0} maxValue={256} value={countText} strokeWidth={16} styles={buildStyles({
                                            strokeLinecap: 'butt',
                                            pathTransitionDuration: 0.5,
                                            pathColor: `rgba(62, 152, 199`,
                                            textColor: '#f88',
                                            trailColor: '#d6d6d6',
                                            backgroundColor: '#3e98c7',
                                        })} />
                                    </div>
                                    <Button onClick={handleClick} style={{ width: "100px", height: "auto" }} type="primary">Paylaş</Button>
                                </div>
                            </div>
                        )
                    }

                    {data ? (
                        <PostList>
                            {data.map((item, index) => (
                                <Post key={index} item={item} />
                            ))}
                        </PostList>
                    ) : (
                        <p>Yükleniyor Lütfen Bekleyin...</p>
                    )}
                </div>
                <NavBarMobile />
            </div>
            <div>
                <div className="menu">
                    <Search placeholder="Bir şeyler ara" style={{ width: 250, margin: "18px" }} enterButton />
                </div>
            </div>

        </div>
    )
}