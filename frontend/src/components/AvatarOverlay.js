import { TbPhotoEdit } from "react-icons/tb";
import React, { useState, useRef } from 'react';
import { Button, Modal } from 'antd';
import Cropper, { ReactCropperElement } from "react-cropper";
import "cropperjs/dist/cropper.css";
import axios from "axios";
import { Skeleton } from "antd";

export default function AvatarOverlay(props) {

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [imageSrc, setImage] = useState(null);
    const [isLoaded, setIsLoaded] = useState(false);
    const inputFile = useRef(null);
    const cropper = useRef(null);

    const showModal = () => {
        setIsModalOpen(true);
    };

    const handleOk = () => {
        document.querySelector('.avatar').src = cropper.current.cropper.getCroppedCanvas().toDataURL()
        cropper.current.cropper.getCroppedCanvas().toBlob(function (blob) {
            const formData = new FormData();
            formData.append('avatar', blob)
            axios.post('/api/change_avatar', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
                responseType: 'blob'
            })
        })

        setIsModalOpen(false);
    };

    const onButtonClick = () => {
        inputFile.current.click();
    };
    const handleCancel = () => {
    };

    const onUpload = () => {
        const files = inputFile.current.files;

        if (FileReader && files && files.length) {
            var fr = new FileReader();
            fr.onload = function () {
                setImage(fr.result);

                showModal();
            }
            fr.readAsDataURL(files[0]);
        }
    };

    const onLoad = () => {
        setIsLoaded(true);
    }

    return (
        <div>
            <input onChange={onUpload} type='file' id='file' ref={inputFile} style={{ display: 'none' }} accept="image/png, image/jpeg" />

            <div onClick={onButtonClick} className="avatar-container">
                {
                    (!isLoaded) ? (
                        <Skeleton.Avatar size={100} active />
                    ):( <></>)
                }
                <img style={{display: isLoaded ? 'block' : 'none'}} src={props.src} onLoad={onLoad} />

                <div className="overlay">
                    <TbPhotoEdit class="icon" />
                </div>
            </div>

            <Modal title="Profil Fotoğrafını Değiştir"
                //centered
                open={isModalOpen}
                onOk={handleOk}
                onCancel={handleCancel}
                footer={[
                    <Button key="back" onClick={handleCancel}>
                        İptal
                    </Button>,
                    <Button key="submit" type="primary" onClick={handleOk}>
                        Kaydet
                    </Button>,
                ]}>
                <Cropper
                    ref={cropper}
                    background={false}
                    src={imageSrc}
                    style={{ height: 400, width: '100%' }}
                    aspectRatio={1}
                    guides={true}
                    viewMode={2}
                />

            </Modal>
        </div>
    )
}