import { LockOutlined, UserOutlined } from '@ant-design/icons';
import { Button, Checkbox, Form, Input } from 'antd';
import { useAuth } from "../auth/AuthProvider";
import { TbSocial } from "react-icons/tb";
import { Link } from "react-router-dom";
import React from "react";
import '../login.css';

export default function Login() {
    const auth = useAuth();

    const onFinish = (values) => {
        auth.loginAction(values);
    };
    const onFinishFailed = (errorInfo) => {
        console.log('Failed:', errorInfo);
    };

    React.useEffect(() => {
        document.getElementById("root").style.height = "100%";
    }, []);

    return (
        <div className='login-container'>
            <TbSocial size={100} />
            <div className='login-name'>
                <b style={{ textAlign: "center" }}>Kaan's Social App Login</b>
            </div>
            <hr style={{ width: "25%" }}></hr>
            <div className='error-login'>
                <b>Şifre veya Email Hatalı!</b>
            </div>
            <div className='login-form'>
                <Form
                    name="normal_login"
                    initialValues={{
                        remember: true,
                    }}
                    onFinish={onFinish}
                    onFinishFailed={onFinishFailed}
                >
                    <Form.Item
                        name="username"
                        rules={[
                            {
                                required: true,
                                message: 'Please input your Username!',
                            },
                        ]}
                    >
                        <Input prefix={<UserOutlined className="site-form-item-icon" />} placeholder="Username" />
                    </Form.Item>
                    <Form.Item
                        name="password"
                        rules={[
                            {
                                required: true,
                                message: 'Please input your Password!',
                            },
                        ]}
                    >
                        <Input
                            prefix={<LockOutlined className="site-form-item-icon" />}
                            type="password"
                            placeholder="Password"
                        />
                    </Form.Item>
                    <Form.Item>
                        <Form.Item name="remember" valuePropName="checked" noStyle>
                            <Checkbox>Beni Hatırla</Checkbox>
                        </Form.Item>
                    </Form.Item>

                    <Form.Item>
                        <Button type="primary" htmlType="submit" className="login-form-button" style={{ width: "100%" }}>
                            Log in
                        </Button>
                        <br></br>
                        Ya da <Link to="/social/register"><b>Kayıt ol!</b></Link>
                    </Form.Item>
                </Form>
            </div>
        </div>
    )
}