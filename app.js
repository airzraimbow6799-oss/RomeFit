document.addEventListener('DOMContentLoaded', () => {

    // ============================================================
    // 3D AVATAR IMPLEMENTATION (THREE.JS)
    // ============================================================
    class Mannequin3D {
        constructor(scene, isModal = false) {
            this.group = new THREE.Group();
            this.bodyGroup = new THREE.Group();
            this.shirtGroup = new THREE.Group();

            this.group.add(this.bodyGroup);
            this.group.add(this.shirtGroup);
            this.group.position.y = 0.5;
            scene.add(this.group);

            this.isModal = isModal;
            this.loadedBody = null;
            this.loadedShirt = null;

            // Load the GLB models
            if (window.THREE && window.THREE.GLTFLoader) {
                const loader = new THREE.GLTFLoader();

                // 1. Cargar Cuerpo
                loader.load('Cuerpo 3d/male_human_a_pose.glb', (gltf) => {
                    this.loadedBody = gltf.scene;

                    this.loadedBody.traverse((child) => {
                        if (child.isMesh) {
                            child.material = new THREE.MeshStandardMaterial({
                                color: 0x222222,
                                roughness: 0.7,
                                metalness: 0.1
                            });
                        }
                        // Ajuste fino: Levantar significativamente los brazos para que entren en las mangas
                        if (child.isBone) {
                            const name = child.name.toLowerCase();
                            // Hombro/Brazo izquierdo (Levantar: +Z)
                            if (name.includes('leftarm') || name.includes('arm_l') || name.includes('upperarm_l') || name === 'mixamorig:leftarm') {
                                child.rotation.z += 0.8; // Aprox 45 grados hacia arriba
                            }
                            // Hombro/Brazo derecho (Levantar: -Z)
                            if (name.includes('rightarm') || name.includes('arm_r') || name.includes('upperarm_r') || name === 'mixamorig:rightarm') {
                                child.rotation.z -= 0.8;
                            }
                        }
                    });

                    const box = new THREE.Box3().setFromObject(this.loadedBody);
                    const size = box.getSize(new THREE.Vector3());
                    const center = box.getCenter(new THREE.Vector3());

                    const targetHeight = 6.5;
                    const scale = targetHeight / size.y;
                    this.loadedBody.scale.set(scale, scale, scale);

                    this.loadedBody.position.x = -center.x * scale;
                    this.loadedBody.position.y = (-center.y * scale) + 0.5;
                    this.loadedBody.position.z = -center.z * scale;

                    this.bodyGroup.add(this.loadedBody);
                }, undefined, (error) => {
                    console.error('Error loading GLB body:', error);
                });

                // 2. Cargar Polo (Camiseta)
                loader.load('Cuerpo 3d/oversized_t-shirt.glb', (gltf) => {
                    this.loadedShirt = gltf.scene;

                    this.loadedShirt.traverse((child) => {
                        if (child.isMesh) {
                            child.material = new THREE.MeshStandardMaterial({
                                color: 0xdddddd, // Blanco por defecto
                                roughness: 0.8,
                                metalness: 0.0,
                                side: THREE.DoubleSide
                            });
                        }
                    });

                    const box = new THREE.Box3().setFromObject(this.loadedShirt);
                    const size = box.getSize(new THREE.Vector3());
                    const center = box.getCenter(new THREE.Vector3());

                    // Como el modelo es inherentemente 'oversize', reducimos su base a 45%
                    const targetHeight = 6.5 * 0.45;
                    const scale = targetHeight / size.y;

                    // Solo incrementamos un 5% la profundidad (Z) para evitar que el pecho traspase, 
                    // devolviendo el ancho (X) a su escala normal para quitar el efecto campana.
                    this.loadedShirt.scale.set(scale, scale, scale * 1.45);

                    this.loadedShirt.position.x = -center.x * scale;
                    // Ajuste de altura (Y)
                    this.loadedShirt.position.y = (-center.y * scale) + 1.9;
                    // Movemos el polo ligerísimamente hacia adelante en Z para salvar los pectorales
                    this.loadedShirt.position.z = (-center.z * scale) + 0.15;

                    this.shirtGroup.add(this.loadedShirt);

                    // Aseguramos que tome el color actual
                    this.setColor(currentColor);
                }, undefined, (error) => {
                    console.error('Error loading GLB polo:', error);
                });
            }
        }

        update(pWidthMod, pLengthMod, torsoType, abdomenType, tWidthMod, tLengthMod) {
            // 1. Modificar el cuerpo
            let bodyScaleX = 1.0 + (pWidthMod * 0.5);
            let bodyScaleY = 1.0 + (pLengthMod * 0.2);
            let bodyScaleZ = 1.0 + (pWidthMod * 0.5);

            if (torsoType === 'anchos') bodyScaleX += 0.15;
            if (torsoType === 'caidos') bodyScaleX -= 0.1;

            if (abdomenType === 'robusto') bodyScaleZ += 0.3;
            if (abdomenType === 'plano') bodyScaleZ -= 0.1;

            this.bodyGroup.scale.set(bodyScaleX, bodyScaleY, bodyScaleZ);

            // 2. Modificar la camiseta (Shirt GLB)
            // Ya no forzamos un encogimiento extremo porque ahora el maniquí mismo 
            // reduce su masa corporal para tallas más pequeñas.
            let slimFactorX = -0.02; // Apenas -2% de ajuste
            let slimFactorZ = 0.0; 
            
            // El multiplicador de holgura (tWidthMod) asegura que crezca para L y XL
            let shirtScaleX = bodyScaleX + slimFactorX + (tWidthMod * 0.45);
            let shirtScaleY = bodyScaleY + (tLengthMod * 0.25);
            let shirtScaleZ = bodyScaleZ + slimFactorZ + (tWidthMod * 0.35);

            this.shirtGroup.scale.set(shirtScaleX, shirtScaleY, shirtScaleZ);

            // Compensación de posición Y al escalar:
            // Al estirarse la ropa (scaleY > 1), se desplaza hacia arriba alejándose del torso. 
            // Esta línea empuja la ropa hacia abajo proporcionalmente para mantenerla anclada a los hombros.
            this.shirtGroup.position.y = -(shirtScaleY - 1) * 0.8;
        }

        setColor(color) {
            const hexColor = color === 'white' ? 0xdddddd : 0x111111;
            if (this.loadedShirt) {
                this.loadedShirt.traverse((child) => {
                    if (child.isMesh && child.material) {
                        child.material.color.setHex(hexColor);
                    }
                });
            }
        }
    }

    function init3DScene(containerId, isModal) {
        const container = document.getElementById(containerId);
        if (!container) return null;

        const scene = new THREE.Scene();
        // Transparent background
        scene.background = null;

        const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 100);
        camera.position.set(0, 1, 10);

        const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
        renderer.setSize(container.clientWidth, container.clientHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
        container.appendChild(renderer.domElement);

        const controls = new THREE.OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controls.enablePan = false;
        controls.minDistance = 5;
        controls.maxDistance = 15;
        // Limit vertical rotation to not go under the floor
        controls.maxPolarAngle = Math.PI / 2 + 0.2;

        // Luces premium
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        scene.add(ambientLight);

        const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
        dirLight.position.set(5, 5, 5);
        scene.add(dirLight);

        const fillLight = new THREE.DirectionalLight(0x90b0d0, 0.5);
        fillLight.position.set(-5, 0, -5);
        scene.add(fillLight);

        const mannequin = new Mannequin3D(scene, isModal);

        function animate() {
            requestAnimationFrame(animate);
            controls.update();
            renderer.render(scene, camera);
        }
        animate();

        // Handle resize
        window.addEventListener('resize', () => {
            if (container.clientWidth > 0) {
                camera.aspect = container.clientWidth / container.clientHeight;
                camera.updateProjectionMatrix();
                renderer.setSize(container.clientWidth, container.clientHeight);
            }
        });

        return mannequin;
    }

    let mainMannequin = null;
    let modalMannequin = null;

    // Iniciar escenas con timeout para asegurar que el DOM este listo
    setTimeout(() => {
        mainMannequin = init3DScene('main-3d-container', false);
        modalMannequin = init3DScene('modal-3d-container', true);
        if (mainMannequin) renderMainTshirt('M');
        if (modalMannequin) refreshModalPreview();
    }, 100);

    // ============================================================
    // SIZE DATA TABLE
    // ============================================================
    const SIZE_DATA = {
        'XS': { widthMod: 0.0, lengthMod: 0.0, ancho: '42 cm', largo: '66 cm', holguraLabel: 'Slim', fitPos: 0.05 },
        'S': { widthMod: 0.2, lengthMod: 0.2, ancho: '46 cm', largo: '69 cm', holguraLabel: 'Regular', fitPos: 0.22 },
        'M': { widthMod: 0.38, lengthMod: 0.35, ancho: '50 cm', largo: '71 cm', holguraLabel: 'Regular', fitPos: 0.38 },
        'L': { widthMod: 0.55, lengthMod: 0.5, ancho: '54 cm', largo: '74 cm', holguraLabel: 'Amplio', fitPos: 0.55 },
        'XL': { widthMod: 0.72, lengthMod: 0.65, ancho: '58 cm', largo: '76 cm', holguraLabel: 'Amplio', fitPos: 0.72 },
        'personalizado': { widthMod: 0.5, lengthMod: 0.5, ancho: '—', largo: '—', holguraLabel: '?', fitPos: 0.5 },
    };

    // Active selections
    let currentSize = 'M';
    let currentColor = 'white'; // Cambiado a blanco por defecto

    // ============================================================
    // QUANTITY BUTTONS
    // ============================================================
    const minusBtn = document.getElementById('minus-btn');
    const plusBtn = document.getElementById('plus-btn');
    const qtyInput = document.getElementById('qty-input');

    if (minusBtn && plusBtn && qtyInput) {
        minusBtn.addEventListener('click', () => {
            let v = parseInt(qtyInput.value);
            if (v > 1) qtyInput.value = v - 1;
        });
        plusBtn.addEventListener('click', () => {
            qtyInput.value = parseInt(qtyInput.value) + 1;
        });
    }

    // ============================================================
    // COLOR BUTTONS
    // ============================================================
    const colorBtns = document.querySelectorAll('.color-btn');
    const colorLabel = document.getElementById('color-label');

    colorBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            colorBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            if (btn.classList.contains('black')) {
                if (colorLabel) colorLabel.textContent = 'NEGRO';
                currentColor = 'black';
            } else {
                if (colorLabel) colorLabel.textContent = 'BLANCO';
                currentColor = 'white';
            }
            renderMainTshirt(currentSize);
        });
    });

    // ============================================================
    // SIZE BUTTONS — main product page
    // ============================================================
    const sizeBtns = document.querySelectorAll('.size-btn');
    const sizeLabel = document.getElementById('size-label');
    const customModal = document.getElementById('custom-size-modal');

    sizeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const size = btn.getAttribute('data-size');
            if (size === 'personalizado') {
                sizeBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                if (sizeLabel) sizeLabel.textContent = 'PERSONALIZADO';
                currentSize = 'personalizado';
                renderMainTshirt('personalizado');
                updatePreviewPanel('personalizado'); // FIX: también actualizar el panel
                const matchBadge = document.getElementById('match-badge');
                const mainMatchBadge = document.getElementById('main-match-badge');
                if (matchBadge) matchBadge.classList.add('hidden');
                if (mainMatchBadge) mainMatchBadge.classList.add('hidden');
                openModal(customModal);
                resetWizard();
                return;
            }
            sizeBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentSize = size;
            if (sizeLabel) sizeLabel.textContent = size;

            const matchBadge = document.getElementById('match-badge');
            const mainMatchBadge = document.getElementById('main-match-badge');
            if (matchBadge) matchBadge.classList.add('hidden');
            if (mainMatchBadge) mainMatchBadge.classList.add('hidden');

            renderMainTshirt(size);
            updatePreviewPanel(size);
        });
    });

    // ============================================================
    // RENDER MAIN TSHIRT 3D
    // ============================================================
    function renderMainTshirt(size) {
        if (!mainMannequin) return;
        mainMannequin.setColor(currentColor);

        const data = SIZE_DATA[size] || SIZE_DATA['M'];

        // Centramos las modificaciones del cuerpo en la talla M (0.38 en ancho, 0.35 en largo)
        // De este modo, si seleccionan XS o S, el cuerpo base del maniquí se encoge.
        const pModW = (data.widthMod - 0.38) * 0.8;
        const pModH = (data.lengthMod - 0.35) * 0.8;

        mainMannequin.update(pModW, pModH, 'promedio', 'promedio', data.widthMod, data.lengthMod);
    }

    // ============================================================
    // UPDATE PREVIEW PANEL (main product page)
    // ============================================================
    function updatePreviewPanel(size) {
        const data = SIZE_DATA[size] || SIZE_DATA['M'];

        // Badge
        const badge = document.getElementById('preview-badge');
        if (badge) badge.textContent = size === 'personalizado' ? 'CUSTOM' : size;

        // Metrics
        const mAncho = document.getElementById('metric-ancho');
        const mLargo = document.getElementById('metric-largo');
        const mHolgura = document.getElementById('metric-holgura');
        if (mAncho) mAncho.textContent = data.ancho;
        if (mLargo) mLargo.textContent = data.largo;
        if (mHolgura) mHolgura.textContent = data.holguraLabel;

        // Fit bar
        const fill = document.getElementById('fit-bar-fill');
        const thumb = document.getElementById('fit-bar-thumb');
        const pct = data.fitPos * 100;
        if (fill) fill.style.width = `${pct}%`;
        if (thumb) thumb.style.left = `${pct}%`;

        // Chips
        const chipsEl = document.getElementById('size-chips');
        if (chipsEl) {
            if (size === 'personalizado') {
                chipsEl.innerHTML = '<span class="chip chip-custom">⚙ Talla a medida</span>';
            } else if (['XS', 'S'].includes(size)) {
                chipsEl.innerHTML = '<span class="chip chip-success">✓ Disponible</span><span class="chip chip-neutral">Fit ajustado</span>';
            } else if (['L', 'XL'].includes(size)) {
                chipsEl.innerHTML = '<span class="chip chip-success">✓ Disponible</span><span class="chip chip-neutral">Fit amplio</span>';
            } else {
                chipsEl.innerHTML = '<span class="chip chip-success">✓ Disponible</span><span class="chip chip-neutral">Talla estándar</span>';
            }
        }
    }

    // Initialize preview on load
    renderMainTshirt('M');
    updatePreviewPanel('M');

    // ============================================================
    // MODAL HELPERS
    // ============================================================
    const confeccionModal = document.getElementById('confeccion-modal');
    const closeModalBtn = document.getElementById('close-modal');
    const closeConfeccionBtn = document.getElementById('close-confeccion');

    function openModal(modal) {
        modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
        // Forzar un evento de 'resize' asíncrono para que el canvas de ThreeJS
        // recalcule su tamaño ahora que el modal (que antes era 0x0 por estar oculto) es visible.
        setTimeout(() => {
            window.dispatchEvent(new Event('resize'));
        }, 50);
    }
    function closeModal(modal) {
        modal.classList.add('hidden');
        document.body.style.overflow = 'auto';
    }

    closeModalBtn.addEventListener('click', () => {
        closeModal(customModal);
        // Revert to previous standard size if user cancels
        if (currentSize === 'personalizado') {
            sizeBtns.forEach(b => b.classList.remove('active'));
            const mBtn = document.getElementById('size-btn-M');
            if (mBtn) mBtn.classList.add('active');
            currentSize = 'M';
            sizeLabel.textContent = 'M';
            renderMainTshirt('M');
            updatePreviewPanel('M');
        }
    });

    closeConfeccionBtn.addEventListener('click', () => {
        closeModal(confeccionModal);
    });

    // Eventos para Guía de Tallas
    const sizeGuideLink = document.querySelector('.size-guide');
    const sizeGuideModal = document.getElementById('size-guide-modal');
    const closeGuideModalBtn = document.getElementById('close-guide-modal');
    const btnGuideToCustom = document.getElementById('btn-guide-to-custom');

    if (sizeGuideLink) {
        sizeGuideLink.addEventListener('click', (e) => {
            e.preventDefault();
            openModal(sizeGuideModal);
        });
    }

    if (closeGuideModalBtn) {
        closeGuideModalBtn.addEventListener('click', () => {
            closeModal(sizeGuideModal);
        });
    }

    if (btnGuideToCustom) {
        btnGuideToCustom.addEventListener('click', () => {
            closeModal(sizeGuideModal);
            // Simular click en el botón de Personalizado
            const customBtn = document.getElementById('size-btn-personalizado');
            if (customBtn) customBtn.click();
            else openModal(customModal);
        });
    }

    // Cerrar modales al hacer click fuera
    window.addEventListener('click', (e) => {
        if (e.target === customModal) closeModal(customModal);
        if (e.target === confeccionModal) closeModal(confeccionModal);
        if (e.target === sizeGuideModal) closeModal(sizeGuideModal);
        if (e.target === paymentModal) closeModal(paymentModal);
        if (e.target === successModal) closeModal(successModal);
    });

    // ============================================================
    // PAYMENT & CHECKOUT LOGIC
    // ============================================================
    const paymentModal = document.getElementById('payment-modal');
    const closePaymentBtn = document.getElementById('close-payment');
    const successModal = document.getElementById('success-modal');
    const btnCloseSuccess = document.getElementById('btn-close-success');
    
    // Botones que abren el checkout
    const btnBuyNowMain = document.querySelector('.btn-buy-now'); // Botón principal "COMPRAR AHORA"
    const btnBuyNowCustom = document.querySelector('.custom-buy-btn'); // Botón en el modal de confección

    if (btnBuyNowMain) {
        btnBuyNowMain.addEventListener('click', () => {
            openModal(paymentModal);
        });
    }

    if (btnBuyNowCustom) {
        btnBuyNowCustom.addEventListener('click', () => {
            closeModal(confeccionModal);
            openModal(paymentModal);
        });
    }

    if (closePaymentBtn) {
        closePaymentBtn.addEventListener('click', () => closeModal(paymentModal));
    }

    // Toggle Delivery form
    const deliveryRadios = document.querySelectorAll('input[name="delivery_method"]');
    const deliveryForm = document.getElementById('delivery-form');
    
    deliveryRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            if (e.target.value === 'delivery') {
                deliveryForm.classList.remove('hidden');
            } else {
                deliveryForm.classList.add('hidden');
            }
        });
    });

    // Pago completado
    const btnCompletePayment = document.getElementById('btn-complete-payment');
    if (btnCompletePayment) {
        btnCompletePayment.addEventListener('click', () => {
            closeModal(paymentModal);
            openModal(successModal);
        });
    }

    // Cerrar éxito y volver
    if (btnCloseSuccess) {
        btnCloseSuccess.addEventListener('click', () => {
            closeModal(successModal);
            // Opcional: resetear la selección de talla a M
            const mBtn = document.getElementById('size-btn-M');
            if (mBtn) mBtn.click();
        });
    }

    // ============================================================
    // WIZARD STATE
    // ============================================================
    const steps = document.querySelectorAll('.wizard-step');
    const nextBtns = document.querySelectorAll('.btn-next');
    const prevBtns = document.querySelectorAll('.btn-prev');
    const finishBtn = document.getElementById('btn-finish-wizard');
    const progressBar = document.getElementById('progress-bar');
    const wizardContainer = document.getElementById('wizard-container');
    const loadingContainer = document.getElementById('loading-container');

    let currentStep = 1;
    const totalSteps = 4;

    // Live wizard data
    const wizardData = {
        estatura: null, peso: null, edad: null,
        torso: null, abdomen: null, holgura: null
    };

    // ============================================================
    // WIZARD NAVIGATION
    // ============================================================
    function updateWizard() {
        steps.forEach(s => s.classList.add('hidden'));
        const el = document.getElementById(`step-${currentStep}`);
        if (el) el.classList.remove('hidden');
        const progress = ((currentStep - 1) / (totalSteps - 1)) * 100;
        progressBar.style.width = `${progress}%`;
    }

    nextBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            if (currentStep < totalSteps) {
                currentStep++;
                updateWizard();
            }
        });
    });

    prevBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            if (currentStep > 1) {
                currentStep--;
                updateWizard();
            }
        });
    });

    function resetWizard() {
        currentStep = 1;
        document.getElementById('w-estatura').value = '';
        document.getElementById('w-peso').value = '';
        document.getElementById('w-edad').value = '';
        document.querySelectorAll('input[type="radio"]').forEach(r => r.checked = false);
        document.querySelectorAll('.radio-option').forEach(l => l.classList.remove('selected'));
        wizardData.estatura = null; wizardData.peso = null; wizardData.edad = null;
        wizardData.torso = null; wizardData.abdomen = null; wizardData.holgura = null;
        wizardContainer.classList.remove('hidden');
        loadingContainer.classList.add('hidden');
        updateWizard();
        refreshModalPreview();
    }

    // ============================================================
    // LIVE INPUT LISTENERS — step 1
    // ============================================================
    const wEstatura = document.getElementById('w-estatura');
    const wPeso = document.getElementById('w-peso');
    const wEdad = document.getElementById('w-edad');

    [wEstatura, wPeso, wEdad].forEach(input => {
        input.addEventListener('input', () => {
            wizardData.estatura = parseInt(wEstatura.value) || null;
            wizardData.peso = parseInt(wPeso.value) || null;
            wizardData.edad = parseInt(wEdad.value) || null;
            refreshModalPreview();
        });
    });

    // ============================================================
    // RADIO OPTION LIVE LISTENERS
    // ============================================================
    document.querySelectorAll('.radio-option').forEach(label => {
        label.addEventListener('click', () => {
            const name = label.getAttribute('data-name');
            const val = label.getAttribute('data-val');
            if (!name || !val) return;

            // Highlight selected
            document.querySelectorAll(`.radio-option[data-name="${name}"]`).forEach(l => l.classList.remove('selected'));
            label.classList.add('selected');

            wizardData[name] = val;
            refreshModalPreview();
        });
    });

    // ============================================================
    // COMPUTE ESTIMATED SIZE FROM WIZARD DATA
    // ============================================================
    function computeEstimatedSize() {
        const sizeMap = ['XS', 'S', 'M', 'L', 'XL'];
        let idx = 2; // default M

        const peso = wizardData.peso || 70;
        if (peso < 60) idx = 0;
        else if (peso <= 70) idx = 1;
        else if (peso <= 80) idx = 2;
        else if (peso <= 95) idx = 3;
        else idx = 4;

        const estatura = wizardData.estatura || 170;
        if (estatura > 185 && idx < 2) idx++;

        if (wizardData.torso === 'anchos') idx += 0.5;
        if (wizardData.abdomen === 'robusto') idx += 1;

        const holgura = wizardData.holgura;
        if (holgura === 'oversize') idx += 1;
        else if (holgura === 'extreme') idx += 2;

        const finalIdx = Math.floor(idx);
        const needsConfeccion = finalIdx > 4 || (peso >= 120 && finalIdx >= 4 && holgura !== 'moderado');
        if (needsConfeccion) return { size: 'CONF.', needsConfeccion: true, finalIdx };

        return { size: sizeMap[Math.min(finalIdx, 4)], needsConfeccion: false, finalIdx };
    }

    // ============================================================
    // COMPUTE FIT POSITION FROM WIZARD DATA
    // ============================================================
    function computeFitPos() {
        const holgura = wizardData.holgura;
        if (!holgura) return 0.38; // default M
        if (holgura === 'moderado') return 0.25;
        if (holgura === 'oversize') return 0.65;
        if (holgura === 'extreme') return 0.92;
        return 0.38;
    }

    // ============================================================
    // COMPUTE VISUAL TSHIRT PARAMS FROM WIZARD DATA
    // ============================================================
    function computeModalTshirtParams() {
        const peso = wizardData.peso || 70;
        const estatura = wizardData.estatura || 170;
        const holgura = wizardData.holgura;

        // widthMod based on peso + torso + holgura
        let widthMod = 0.35;
        if (peso < 60) widthMod = 0.15;
        else if (peso <= 70) widthMod = 0.28;
        else if (peso <= 80) widthMod = 0.42;
        else if (peso <= 95) widthMod = 0.58;
        else widthMod = 0.72;

        if (wizardData.torso === 'anchos') widthMod += 0.1;
        if (wizardData.abdomen === 'robusto') widthMod += 0.12;
        if (holgura === 'oversize') widthMod += 0.12;
        if (holgura === 'extreme') widthMod += 0.22;

        // lengthMod based on estatura
        let lengthMod = 0.35;
        if (estatura < 160) lengthMod = 0.1;
        else if (estatura <= 170) lengthMod = 0.28;
        else if (estatura <= 180) lengthMod = 0.45;
        else lengthMod = 0.68;

        widthMod = Math.min(Math.max(widthMod, 0), 1);
        lengthMod = Math.min(Math.max(lengthMod, 0), 1);
        return { widthMod, lengthMod };
    }

    function computeModalPersonParams() {
        const peso = wizardData.peso || 70;
        const estatura = wizardData.estatura || 170;
        const torso = wizardData.torso || 'atleticos';
        const abdomen = wizardData.abdomen || 'promedio';

        // widthMod based strictly on weight for the person body
        let pWidthMod = 0.35;
        if (peso < 60) pWidthMod = 0.1;
        else if (peso <= 70) pWidthMod = 0.25;
        else if (peso <= 80) pWidthMod = 0.40;
        else if (peso <= 95) pWidthMod = 0.60;
        else pWidthMod = 0.85;

        // lengthMod based on height
        let pLengthMod = 0.35;
        if (estatura < 160) pLengthMod = 0.05;
        else if (estatura <= 170) pLengthMod = 0.25;
        else if (estatura <= 180) pLengthMod = 0.50;
        else pLengthMod = 0.80;

        return { pWidthMod, pLengthMod, torso, abdomen };
    }

    // ============================================================
    // RENDER MODAL TSHIRT & PERSON 3D
    // ============================================================
    function renderModalTshirt(widthMod, lengthMod, pWidthMod, pLengthMod, torso, abdomen) {
        if (!modalMannequin) return;
        modalMannequin.update(pWidthMod, pLengthMod, torso, abdomen, widthMod, lengthMod);
    }

    // ============================================================
    // REFRESH MODAL PREVIEW (runs on every wizard input change)
    // ============================================================
    function refreshModalPreview() {
        // 1. Live stats rows
        updateLiveStat('live-estatura', wizardData.estatura ? wizardData.estatura + ' cm' : '—', !!wizardData.estatura);
        updateLiveStat('live-peso', wizardData.peso ? wizardData.peso + ' kg' : '—', !!wizardData.peso);
        updateLiveStat('live-torso', wizardData.torso ? capitalize(wizardData.torso) : '—', !!wizardData.torso);
        updateLiveStat('live-abdomen', wizardData.abdomen ? capitalize(wizardData.abdomen) : '—', !!wizardData.abdomen);
        updateLiveStat('live-holgura', wizardData.holgura ? capitalize(wizardData.holgura) : '—', !!wizardData.holgura);

        // 2. Estimated size badge
        const est = computeEstimatedSize();
        const predBadge = document.getElementById('predicted-badge');
        if (predBadge) predBadge.textContent = est.size;

        // 3. Fit bar
        const fitPos = computeFitPos();
        const mFill = document.getElementById('modal-fit-bar-fill');
        const mThumb = document.getElementById('modal-fit-bar-thumb');
        if (mFill) mFill.style.width = `${fitPos * 100}%`;
        if (mThumb) mThumb.style.left = `${fitPos * 100}%`;

        // 4. Tshirt & Person SVG
        const { widthMod, lengthMod } = computeModalTshirtParams();
        const { pWidthMod, pLengthMod, torso, abdomen } = computeModalPersonParams();
        renderModalTshirt(widthMod, lengthMod, pWidthMod, pLengthMod, torso, abdomen);
    }

    function updateLiveStat(id, text, filled) {
        const valEl = document.getElementById(id);
        if (!valEl) return;
        valEl.textContent = text;
        const row = valEl.closest('.live-stat-row');
        if (row) row.classList.toggle('filled', filled);
    }

    function capitalize(str) {
        if (!str) return '';
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    // ============================================================
    // FINISH WIZARD
    // ============================================================
    finishBtn.addEventListener('click', () => {
        const estatura = parseInt(wEstatura.value) || 170;
        const peso = parseInt(wPeso.value) || 70;

        wizardData.estatura = estatura;
        wizardData.peso = peso;
        // FIX: Safe optional chaining — avoid {}.value undefined-then-fallback ambiguity
        const torsoEl = document.querySelector('input[name="torso"]:checked');
        const abdomenEl = document.querySelector('input[name="abdomen"]:checked');
        const holguraEl = document.querySelector('input[name="holgura"]:checked');
        wizardData.torso = torsoEl ? torsoEl.value : 'atleticos';
        wizardData.abdomen = abdomenEl ? abdomenEl.value : 'promedio';
        wizardData.holgura = holguraEl ? holguraEl.value : 'moderado';

        wizardContainer.classList.add('hidden');
        loadingContainer.classList.remove('hidden');

        // Secuencia simulada de Machine Learning y Fabric Drape
        const loadingText = document.getElementById('loading-text');
        if (loadingText) loadingText.textContent = 'Analizando anatomía y biometría...';

        setTimeout(() => {
            if (loadingText) loadingText.textContent = 'Procesando modelo de Machine Learning con historial de compras...';
        }, 800);

        setTimeout(() => {
            if (loadingText) loadingText.textContent = 'Simulando caída de tela (gramaje)...';
        }, 1600);

        setTimeout(() => {
            closeModal(customModal);

            const sizeMap = ['XS', 'S', 'M', 'L', 'XL'];
            let idx = 2;
            if (peso < 60) idx = 0;
            else if (peso <= 70) idx = 1;
            else if (peso <= 80) idx = 2;
            else if (peso <= 95) idx = 3;
            else idx = 4;

            if (estatura > 185 && idx < 2) idx++;
            if (wizardData.torso === 'anchos') idx += 0.5;
            if (wizardData.abdomen === 'robusto') idx += 1;
            if (wizardData.holgura === 'oversize') idx += 1;
            else if (wizardData.holgura === 'extreme') idx += 2;

            const finalIdx = Math.floor(idx);
            const needsConfeccion = finalIdx > 4 || (peso >= 120 && finalIdx >= 4 && wizardData.holgura !== 'moderado');

            if (needsConfeccion) {
                setTimeout(() => openModal(confeccionModal), 300);
            } else {
                const finalSize = sizeMap[Math.min(finalIdx, 4)];
                // Activate the corresponding size button
                sizeBtns.forEach(b => b.classList.remove('active'));
                const targetBtn = document.getElementById(`size-btn-${finalSize}`);
                if (targetBtn) {
                    targetBtn.classList.add('active');
                    // FIX: removed unused originalText variable
                    targetBtn.textContent = `${finalSize} ✓`;
                    setTimeout(() => { targetBtn.textContent = finalSize; }, 3000);
                }
                currentSize = finalSize;
                if (sizeLabel) {
                    sizeLabel.textContent = `${finalSize} (Tu Talla Sugerida)`;
                    setTimeout(() => { sizeLabel.textContent = finalSize; }, 3500);
                }

                // Generar porcentaje de Match
                const matchPct = Math.floor(Math.random() * (98 - 91 + 1)) + 91;
                const matchBadge = document.getElementById('match-badge');
                const mainMatchBadge = document.getElementById('main-match-badge');
                if (matchBadge) {
                    matchBadge.textContent = `${matchPct}% Match`;
                    matchBadge.classList.remove('hidden');
                }
                if (mainMatchBadge) {
                    mainMatchBadge.textContent = `${matchPct}% Match`;
                    mainMatchBadge.classList.remove('hidden');
                }

                renderMainTshirt(finalSize);
                updatePreviewPanel(finalSize);
            }
        }, 2400);
    });



});
