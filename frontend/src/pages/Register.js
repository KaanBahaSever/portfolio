import { Button, Checkbox, Form, Input } from 'antd';
import React from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { TbSocial } from "react-icons/tb";
import debounce from "debounce-promise";
import '../login.css';

const baseURL = "https://jsonplaceholder.typicode.com/posts";


const onFinishFailed = (errorInfo) => {
    console.log('Failed:', errorInfo);
};

const request = debounce(async (url, json) => {

    const response = await axios.post("/auth/check_username", json, {
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        }
    })

    return Promise.resolve({ data: { exist: response.data.exist } });
}, 500);

const request2 = debounce(async (url, json) => {
    let emailRegex = /[a-z0-9]+@[a-z]+\.[a-z]{2,3}/;
    if (emailRegex.test(json.email)) {
        const response = await axios.post("/auth/check_email", json, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        })
        return Promise.resolve({ data: { exist: response.data.exist } });
    }
    else {
        return Promise.resolve({ data: { exist: false } });
    }
}, 500);

/* const validatePassword = (rule, value, callback) => {
    if (value && value !== "Secret") {
        callback("Error!");
    } else {
        callback();
    }
}; */

export default function Register() {
    const [form] = Form.useForm();
    const navigate = useNavigate();

    const onFinish = (values) => {
        console.log('Success:', values);

        axios.post("/auth/register", values, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        }).then((response) => {
            console.log(response)
            navigate("/social/login");
        });
    };

    React.useEffect(() => {
        document.getElementById("root").style.height = "100%";
    }, []);

    return (
        <div className='login-container'>
            <TbSocial size={100} />
            <div className='login-name'>
                <b style={{ textAlign: "center" }}>Kaan's Social App Register</b>
            </div>
            <hr style={{ width: "25%" }}></hr>

            <div style={{ width: "100%", display: "flex", justifyContent: "center" }}>
                <Form className='register-form'
                    form={form}
                    layout={"vertical"}
                    name="register"
                    onFinish={onFinish}
                    initialValues={{
                        layout: "vertical",
                    }}
                    scrollToFirstError
                >
                    <Form.Item
                        name="email"
                        label="E-mail"
                        rules={[
                            {
                                type: 'email',
                                message: 'The input is not valid E-mail!',
                            },
                            {
                                required: true,
                                message: 'Please input your E-mail!',
                            },
                            {
                                validator(rule, value) {
                                    return new Promise((resolve, reject) => {
                                        request2("/auth/check_email", { email: value }).then(
                                            (response) => {
                                                if (response.data.exist) {
                                                    reject("Email Zaten Kayıtlı");
                                                } else {
                                                    resolve();
                                                }
                                            }
                                        );
                                    });
                                }
                            }
                        ]}
                    >
                        <Input />
                    </Form.Item>

                    <Form.Item
                        name="password"
                        label="Password"
                        rules={[
                            {
                                required: true,
                                message: 'Please input your password!',
                            },
                            //{ validator: validatePassword }
                        ]}
                        hasFeedback
                    >
                        <Input.Password />
                    </Form.Item>

                    <Form.Item
                        name="confirm"
                        label="Confirm Password"
                        dependencies={['password']}
                        hasFeedback
                        rules={[
                            {
                                required: true,
                                message: 'Please confirm your password!',
                            },
                            ({ getFieldValue }) => ({
                                validator(_, value) {
                                    if (!value || getFieldValue('password') === value) {
                                        return Promise.resolve();
                                    }
                                    return Promise.reject(new Error('The new password that you entered do not match!'));
                                },
                            }),
                        ]}
                    >
                        <Input.Password />
                    </Form.Item>

                    <Form.Item
                        name="username"
                        label="Username"
                        tooltip="What do you want others to call you?"
                        rules={[
                            {
                                required: true,
                                message: 'Please input your username!',
                                whitespace: false,
                            }, {
                                message: 'Özel Karakter İçermemeli',
                                validator: (_, value) => {
                                    if (/^[a-zA-Z0-9]+$/.test(value)) {
                                        return Promise.resolve();
                                    } else {
                                        return Promise.reject('Some message here');
                                    }
                                }
                            },
                            {
                                validator(rule, value) {
                                    return new Promise((resolve, reject) => {
                                        request("/auth/check_username", { username: value }).then(
                                            (response) => {
                                                if (response.data.exist) {
                                                    reject("Kullanıcı Adı Zaten Kayıtlı");
                                                } else {
                                                    resolve();
                                                }
                                            }
                                        );
                                    });
                                }
                            }
                        ]}
                    >
                        <Input autoComplete='off' />
                    </Form.Item>

                    <Form.Item
                        name="agreement"
                        valuePropName="checked"
                        rules={[
                            {
                                validator: (_, value) =>
                                    value ? Promise.resolve() : Promise.reject(new Error('Should accept agreement')),
                            },
                        ]}
                    >
                        <Checkbox>
                            I have read the <a href="">agreement</a>
                        </Checkbox>
                    </Form.Item>

                    <Form.Item>
                        <Button type="primary" htmlType="submit" style={{ width: "100%" }}>
                            Register
                        </Button>
                    </Form.Item>
                </Form>
            </div>
        </div>

    )
}