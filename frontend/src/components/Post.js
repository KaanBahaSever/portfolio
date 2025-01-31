import { Link } from "react-router-dom";

export default function Post(props) {
    return (
        <div className="post">
            <div className="post-body">
                <div className="profile">
                    <img src={props.item.user.avatar}></img>
                </div>
                <div className="post-content">
                    <div style={{ display: "flex" }}>
                        <b style={{ fontSize: 16 }}>
                            <Link to={'/social/profile/' + props.item.user.id}>
                                @{props.item.user.username}
                            </Link>
                        </b>
                        <span style={{ marginLeft: "auto" }}>{props.item.elapsed}</span>
                    </div>

                    <div>
                        {props.item.body}
                    </div>
                </div>
            </div>

            {/* <div className="post-footer">
                Likes
            </div> */}
        </div>
    )
}